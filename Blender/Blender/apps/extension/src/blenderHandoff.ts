import { constants as fsConstants, existsSync } from "node:fs";
import { copyFile, link, lstat, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";
import type * as vscode from "vscode";
import { isInsideDirectory, resolveBlenderScriptPath, sanitizeBlenderBaseName } from "./blenderPlan.js";
import { assertSafeBlenderScript, runBlenderCommand, type BlenderCommandRunner } from "./blenderRunner.js";

export type BlenderSvgHandoffResult = { scenePath: string; reportPath: string };

export async function createBlenderSceneFromSvg(options: {
  blenderPath: string;
  svgPath: string;
  sourceName: string;
  workspaceRoot: string;
  assetWorkspace: string;
  extensionRoot: string;
  outputChannel: vscode.OutputChannel;
  timeoutMs: number;
  signal?: AbortSignal;
  processRunner?: BlenderCommandRunner;
}): Promise<BlenderSvgHandoffResult> {
  const workspaceRoot = await realpath(path.resolve(options.workspaceRoot));
  const assetRoot = path.resolve(workspaceRoot, options.assetWorkspace);
  if (!isInsideDirectory(workspaceRoot, assetRoot) || assetRoot === workspaceRoot)
    throw new Error("Avatar workspace is unsafe.");
  await mkdir(assetRoot, { recursive: true });
  const assetInfo = await lstat(assetRoot);
  if (!assetInfo.isDirectory() || assetInfo.isSymbolicLink())
    throw new Error("Avatar workspace must not be a symbolic link.");
  const assetRootReal = await realpath(assetRoot);
  if (!isInsideDirectory(workspaceRoot, assetRootReal))
    throw new Error("Avatar workspace escapes the trusted workspace.");
  const svgPath = path.resolve(options.svgPath);
  const svgInfo = await lstat(svgPath).catch(() => null);
  if (!svgInfo?.isFile() || svgInfo.isSymbolicLink() || svgInfo.size === 0 || svgInfo.size > 10 * 1024 * 1024) {
    throw new Error("SVG handoff input must be a safe nonempty local file.");
  }
  const svgReal = await realpath(svgPath);
  if (!isInsideDirectory(assetRootReal, svgReal) || path.extname(svgReal).toLowerCase() !== ".svg") {
    throw new Error("SVG handoff input must stay inside the avatar workspace.");
  }
  const svg = await readFile(svgReal, "utf8");
  if (!/<svg\b/i.test(svg) || sanitizeSvg(svg) !== svg) throw new Error("SVG handoff input is not sanitized SVG.");

  const outputRoot = path.join(assetRootReal, "exports", "blender");
  const stagingRoot = path.join(assetRootReal, "cache", "jobs", `svg-handoff-${randomUUID()}`);
  await mkdir(outputRoot, { recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  const outputRootReal = await realpath(outputRoot);
  const stagingRootReal = await realpath(stagingRoot);
  if (!isInsideDirectory(assetRootReal, outputRootReal) || !isInsideDirectory(assetRootReal, stagingRootReal)) {
    throw new Error("Blender handoff output path escapes the avatar workspace.");
  }
  const baseName = allocateBaseName(outputRoot, sanitizeBlenderBaseName(path.parse(options.sourceName).name));
  const scenePath = path.join(outputRoot, `${baseName}.working.blend`);
  const reportPath = path.join(outputRoot, `${baseName}.scene.export-report.json`);
  const stagedScene = path.join(stagingRoot, path.basename(scenePath));
  const stagedReport = path.join(stagingRoot, path.basename(reportPath));
  const scriptPath = resolveBlenderScriptPath(options.extensionRoot, "import_svg_scene.py");
  await assertSafeBlenderScript(scriptPath, options.extensionRoot);
  const runner = options.processRunner ?? runBlenderCommand;

  try {
    await runner(
      options.blenderPath,
      [
        "--disable-autoexec",
        "--background",
        "--python",
        scriptPath,
        "--",
        "--input",
        svgReal,
        "--output",
        stagedScene,
        "--manifest",
        stagedReport
      ],
      options.outputChannel,
      { timeoutMs: options.timeoutMs, ...(options.signal ? { signal: options.signal } : {}) }
    );
    await validateHandoff(stagedScene, stagedReport, path.basename(svgReal));
    await publishExclusively(stagedScene, scenePath);
    try {
      await publishExclusively(stagedReport, reportPath);
    } catch (error) {
      await rm(scenePath, { force: true });
      throw error;
    }
    return { scenePath, reportPath };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

async function validateHandoff(scenePath: string, reportPath: string, sourceFile: string): Promise<void> {
  const [sceneInfo, reportInfo] = await Promise.all([
    lstat(scenePath).catch(() => null),
    lstat(reportPath).catch(() => null)
  ]);
  if (!sceneInfo?.isFile() || sceneInfo.isSymbolicLink() || sceneInfo.size < 12 || sceneInfo.size > 128 * 1024 * 1024) {
    throw new Error("Blender handoff did not create a valid-sized regular scene file.");
  }
  const header = await readFile(scenePath).then((value) => value.subarray(0, 7).toString("ascii"));
  if (header !== "BLENDER") throw new Error("Blender handoff output has an invalid .blend header.");
  if (!reportInfo?.isFile() || reportInfo.isSymbolicLink() || reportInfo.size === 0 || reportInfo.size > 64 * 1024) {
    throw new Error("Blender handoff report is missing or unsafe.");
  }
  const report: unknown = JSON.parse(await readFile(reportPath, "utf8"));
  if (
    !report ||
    typeof report !== "object" ||
    (report as Record<string, unknown>).schemaVersion !== 1 ||
    (report as Record<string, unknown>).mode !== "svg-handoff" ||
    (report as Record<string, unknown>).sourceFile !== sourceFile ||
    (report as Record<string, unknown>).outputFile !== path.basename(scenePath) ||
    (report as Record<string, unknown>).collection !== "Export"
  ) {
    throw new Error("Blender handoff report is invalid or non-portable.");
  }
}

function allocateBaseName(outputRoot: string, requested: string): string {
  for (let attempt = 1; attempt <= 10_000; attempt += 1) {
    const candidate = attempt === 1 ? requested : `${requested}-${attempt}`;
    if (
      !existsSync(path.join(outputRoot, `${candidate}.working.blend`)) &&
      !existsSync(path.join(outputRoot, `${candidate}.scene.export-report.json`))
    )
      return candidate;
  }
  throw new Error("Could not allocate a Blender handoff filename.");
}

async function publishExclusively(source: string, destination: string): Promise<void> {
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomUUID()}.tmp`);
  try {
    await copyFile(source, temporary, fsConstants.COPYFILE_EXCL);
    await link(temporary, destination).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        throw new Error(`Blender handoff destination already exists: ${path.basename(destination)}`);
      }
      throw error;
    });
  } finally {
    await rm(temporary, { force: true });
  }
}
