import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeBlenderExecutable } from "../apps/extension/dist/blenderProbe.js";
import { runBlenderCommand, runBlenderExportJob } from "../apps/extension/dist/blenderRunner.js";
import { createBlenderSceneFromSvg } from "../apps/extension/dist/blenderHandoff.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(repositoryRoot, "apps", "extension");
const outputChannel = {
  append() {},
  appendLine(value) {
    process.stdout.write(`${value}\n`);
  },
  show() {},
  dispose() {}
};
const probe = await probeBlenderExecutable({});
if (!probe.executablePath || probe.supportState !== "supported") {
  const message = "Blender host smoke skipped because a supported local Blender installation was not found.";
  if (process.env.REQUIRE_BLENDER === "1") throw new Error(message);
  process.stdout.write(`${message}\n`);
  process.exit(0);
}

const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-blender-fixture-"));
const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-blender-workspace-"));
try {
  const blendPath = path.join(fixtureRoot, "Phase7Smoke.blend");
  await runBlenderCommand(
    probe.executablePath,
    [
      "--background",
      "--disable-autoexec",
      "--python",
      path.join(repositoryRoot, "scripts", "blender", "create_smoke_fixture.py"),
      "--",
      "--output",
      blendPath
    ],
    outputChannel,
    { timeoutMs: 120_000 }
  );
  const outcomes = await runBlenderExportJob({
    blenderPath: probe.executablePath,
    blendPath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["glb", "png"],
    allowExternalInput: true,
    outputChannel,
    timeoutMs: 120_000
  });
  if (outcomes.some((outcome) => outcome.status !== "success")) {
    throw new Error(`Real Blender export failed: ${JSON.stringify(outcomes)}`);
  }
  for (const outcome of outcomes) {
    const report = JSON.parse(await readFile(outcome.manifestPath, "utf8"));
    if (report.collection !== "Export" || report.objectCount !== 1) {
      throw new Error(`Collection convention was not preserved: ${JSON.stringify(report)}`);
    }
  }
  const svgPath = path.join(workspaceRoot, ".codex-avatar", "cache", "pictures", "handoff.svg");
  await mkdir(path.dirname(svgPath), { recursive: true });
  await writeFile(
    svgPath,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#55aaff" d="M10 10h80v80H10z"/></svg>\n'
  );
  const handoff = await createBlenderSceneFromSvg({
    blenderPath: probe.executablePath,
    svgPath,
    sourceName: "Handoff Avatar.svg",
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    outputChannel,
    timeoutMs: 120_000
  });
  const handoffReport = JSON.parse(await readFile(handoff.reportPath, "utf8"));
  if (handoffReport.collection !== "Export" || handoffReport.objectCount < 1) {
    throw new Error(`SVG handoff conventions failed: ${JSON.stringify(handoffReport)}`);
  }
  const returnedExport = await runBlenderExportJob({
    blenderPath: probe.executablePath,
    blendPath: handoff.scenePath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    modes: ["glb"],
    outputChannel,
    timeoutMs: 120_000
  });
  if (returnedExport[0]?.status !== "success") throw new Error("SVG handoff scene did not return to GLB export.");
  process.stdout.write(
    `Real Blender ${probe.version?.label ?? "host"} smoke passed for GLB, PNG, SVG curve handoff, and re-export.\n`
  );
} finally {
  await Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(workspaceRoot, { recursive: true, force: true })
  ]);
}
