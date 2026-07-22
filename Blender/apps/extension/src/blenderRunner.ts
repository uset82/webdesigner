import { spawn, type ChildProcess } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { copyFile, link, lstat, mkdir, realpath, rm, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type * as vscode from "vscode";
import type { AvatarExtensionConfig } from "./avatarState.js";
import { parseBlenderVersion, probeBlenderExecutable } from "./blenderProbe.js";
import { validateBlenderExportArtifacts } from "./blenderArtifacts.js";
import {
  createBlenderExportPlans,
  isInsideDirectory,
  type BlenderExportMode,
  type BlenderExportPlan,
  type BlenderExportResult
} from "./blenderPlan.js";

export type { BlenderExportMode, BlenderExportResult } from "./blenderPlan.js";

const DEFAULT_EXPORT_TIMEOUT_MS = 120_000;
const DEFAULT_LOG_LIMIT_BYTES = 256 * 1024;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 30 * 60_000;
const MIN_LOG_LIMIT_BYTES = 128;
const MAX_LOG_LIMIT_BYTES = 4 * 1024 * 1024;

export type BlenderCommandResult = {
  stdout: string;
  stderr: string;
};

export type BlenderCommandOptions = {
  timeoutMs: number;
  signal?: AbortSignal;
  logLimitBytes?: number;
};

export type BlenderCommandRunner = (
  command: string,
  args: string[],
  outputChannel: vscode.OutputChannel,
  options: BlenderCommandOptions
) => Promise<BlenderCommandResult>;

export type RunBlenderExportOptions = {
  blenderPath: string;
  blendPath: string;
  workspaceRoot: string;
  assetWorkspace: string;
  extensionRoot: string;
  modes: BlenderExportMode[];
  outputChannel: vscode.OutputChannel;
  timeoutMs?: number;
  signal?: AbortSignal;
  logLimitBytes?: number;
  processRunner?: BlenderCommandRunner;
  allowExternalInput?: boolean;
};

export type BlenderExportOutcome =
  | ({ status: "success" } & BlenderExportResult)
  | { status: "failed"; mode: BlenderExportMode; message: string };

let activeBlenderJobId: string | null = null;

export async function findBlenderExecutable(
  config: AvatarExtensionConfig,
  outputChannel: vscode.OutputChannel
): Promise<string | null> {
  const result = await probeBlenderExecutable({ configuredPath: config.blenderPath });
  for (const attempt of result.attempts) {
    outputChannel.appendLine(`[Blender probe] ${attempt.source}: ${attempt.state} — ${attempt.message}`);
  }
  return result.supportState === "supported" ? result.executablePath : null;
}

export async function assertBlenderVersion(
  blenderPath: string,
  outputChannel: vscode.OutputChannel,
  versionRunner: BlenderCommandRunner = runBlenderCommand
): Promise<string> {
  const result = await versionRunner(blenderPath, ["--version"], outputChannel, { timeoutMs: 5000 });
  const version = parseBlenderVersion(`${result.stdout}\n${result.stderr}`);
  if (!version) throw new Error("The executable ran, but its version output did not identify Blender.");
  outputChannel.appendLine(`[Blender] ${version.raw}`);
  return version.raw;
}

export async function runBlenderExports(options: RunBlenderExportOptions): Promise<BlenderExportResult[]> {
  const outcomes = await runBlenderExportJob(options);
  const failed = outcomes.find((outcome) => outcome.status === "failed");
  if (failed) throw new Error(`Blender ${failed.mode} export failed: ${failed.message}`);
  return outcomes
    .filter((outcome): outcome is Extract<BlenderExportOutcome, { status: "success" }> => outcome.status === "success")
    .map(({ mode, outputPath, manifestPath }) => ({ mode, outputPath, manifestPath }));
}

export async function runBlenderExportJob(options: RunBlenderExportOptions): Promise<BlenderExportOutcome[]> {
  if (activeBlenderJobId) {
    throw new Error("Another Blender job is already running. Cancel it or wait for it to finish.");
  }

  const jobId = randomUUID();
  activeBlenderJobId = jobId;
  let stagingDirectory: string | undefined;

  try {
    const timeoutMs = boundedInteger(
      options.timeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
      "Blender timeout"
    );
    const logLimitBytes = boundedInteger(
      options.logLimitBytes ?? DEFAULT_LOG_LIMIT_BYTES,
      MIN_LOG_LIMIT_BYTES,
      MAX_LOG_LIMIT_BYTES,
      "Blender log limit"
    );
    const processRunner = options.processRunner ?? runBlenderCommand;
    const plan = createBlenderExportPlans({
      blendPath: options.blendPath,
      workspaceRoot: options.workspaceRoot,
      assetWorkspace: options.assetWorkspace,
      extensionRoot: options.extensionRoot,
      modes: options.modes,
      jobId,
      ...(options.allowExternalInput !== undefined ? { allowExternalInput: options.allowExternalInput } : {})
    });

    throwIfAborted(options.signal);
    await prepareBlenderJobPaths(options, plan);
    stagingDirectory = plan.stagingDirectory;

    const outcomes: BlenderExportOutcome[] = [];
    for (const exportPlan of plan.exports) {
      throwIfAborted(options.signal);
      try {
        await assertSafeBlenderScript(exportPlan.scriptPath, options.extensionRoot);
        options.outputChannel.appendLine(`[Blender] Starting ${exportPlan.label} export.`);
        await processRunner(options.blenderPath, exportPlan.args, options.outputChannel, {
          timeoutMs,
          logLimitBytes,
          ...(options.signal ? { signal: options.signal } : {})
        });
        await assertBlenderExportArtifacts({
          mode: exportPlan.mode,
          outputPath: exportPlan.stagedOutputPath,
          manifestPath: exportPlan.stagedManifestPath
        });
        throwIfAborted(options.signal);
        const [result] = await finalizeBlenderExportArtifacts([exportPlan]);
        if (!result) throw new Error(`Blender ${exportPlan.label} export could not be published.`);
        outcomes.push({
          status: "success",
          mode: result.mode,
          outputPath: result.outputPath,
          manifestPath: result.manifestPath
        });
        options.outputChannel.appendLine(`[Blender] Published validated ${exportPlan.label} export.`);
      } catch (error) {
        if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
        const message = readableError(error);
        outcomes.push({ status: "failed", mode: exportPlan.mode, message });
        options.outputChannel.appendLine(`[Blender] ${exportPlan.label} export failed: ${message}`);
        await Promise.all([
          rm(exportPlan.stagedOutputPath, { force: true }),
          rm(exportPlan.stagedManifestPath, { force: true })
        ]);
      }
    }

    throwIfAborted(options.signal);
    return outcomes;
  } finally {
    if (stagingDirectory) {
      await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
    activeBlenderJobId = null;
  }
}

export async function assertBlenderExportArtifacts(result: BlenderExportResult): Promise<void> {
  await validateBlenderExportArtifacts(result);
}

export async function finalizeBlenderExportArtifacts(plans: BlenderExportPlan[]): Promise<BlenderExportResult[]> {
  const publishedPaths: string[] = [];
  try {
    for (const plan of plans) {
      await publishFileExclusively(plan.stagedOutputPath, plan.outputPath);
      publishedPaths.push(plan.outputPath);
      await publishFileExclusively(plan.stagedManifestPath, plan.manifestPath);
      publishedPaths.push(plan.manifestPath);
    }

    await Promise.all(plans.flatMap((plan) => [unlink(plan.stagedOutputPath), unlink(plan.stagedManifestPath)]));
    return plans.map(({ mode, outputPath, manifestPath }) => ({ mode, outputPath, manifestPath }));
  } catch (error) {
    await Promise.all(publishedPaths.map((publishedPath) => rm(publishedPath, { force: true })));
    throw error;
  }
}

export function runBlenderCommand(
  command: string,
  args: string[],
  outputChannel: vscode.OutputChannel,
  options: BlenderCommandOptions
): Promise<BlenderCommandResult> {
  const timeoutMs = boundedInteger(options.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, "Blender timeout");
  const logLimitBytes = boundedInteger(
    options.logLimitBytes ?? DEFAULT_LOG_LIMIT_BYTES,
    MIN_LOG_LIMIT_BYTES,
    MAX_LOG_LIMIT_BYTES,
    "Blender log limit"
  );
  if (options.signal?.aborted) {
    return Promise.reject(blenderCancelledError("Blender command was cancelled before it started."));
  }

  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        windowsHide: true,
        shell: false,
        detached: process.platform !== "win32"
      });
    } catch (error) {
      reject(
        new Error(
          `Could not start Blender command "${command}": ${error instanceof Error ? error.message : String(error)}`
        )
      );
      return;
    }

    const perStreamLimit = Math.max(MIN_LOG_LIMIT_BYTES / 2, Math.floor(logLimitBytes / 2));
    const stdoutLog = new BoundedPrefixedLog(outputChannel, "[Blender stdout]", perStreamLimit);
    const stderrLog = new BoundedPrefixedLog(outputChannel, "[Blender stderr]", perStreamLimit);
    let settling = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
    };

    const rejectAfterTermination = (error: Error): void => {
      if (settling) {
        return;
      }
      settling = true;
      cleanup();
      void terminateBlenderProcessTree(child).finally(() => {
        stdoutLog.finish();
        stderrLog.finish();
        reject(error);
      });
    };

    const onAbort = (): void => {
      rejectAfterTermination(blenderCancelledError("Blender command was cancelled."));
    };

    const timer = setTimeout(() => {
      rejectAfterTermination(new Error(`Blender command timed out after ${timeoutMs / 1000} seconds.`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => stdoutLog.append(chunk));
    child.stderr?.on("data", (chunk: Buffer | string) => stderrLog.append(chunk));

    child.once("error", (error) => {
      if (settling) {
        return;
      }
      settling = true;
      cleanup();
      stdoutLog.finish();
      stderrLog.finish();
      reject(new Error(`Could not start Blender command "${command}": ${error.message}`));
    });

    child.once("close", (code) => {
      if (settling) {
        return;
      }
      settling = true;
      cleanup();
      stdoutLog.finish();
      stderrLog.finish();
      if (code === 0) {
        resolve({ stdout: stdoutLog.captured, stderr: stderrLog.captured });
      } else {
        const diagnostic = stderrLog.captured || stdoutLog.captured;
        reject(new Error(`Blender exited with code ${code ?? "unknown"}.${diagnostic ? `\n${diagnostic}` : ""}`));
      }
    });

    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) {
      onAbort();
    }
  });
}

export async function terminateBlenderProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) {
    child.kill("SIGKILL");
    return;
  }

  if (process.platform === "win32") {
    await runTaskkill(pid).catch(() => undefined);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
    await waitForChildExit(child, 2000);
    return;
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
  await waitForChildExit(child, 2000);
}

async function prepareBlenderJobPaths(
  options: RunBlenderExportOptions,
  plan: ReturnType<typeof createBlenderExportPlans>
): Promise<void> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const workspaceRootReal = await assertDirectory(workspaceRoot, "workspace");
  await assertSafeInputFile(options.blendPath, workspaceRootReal, options.allowExternalInput === true);

  const assetRoot = path.resolve(workspaceRoot, options.assetWorkspace);
  await mkdir(assetRoot, { recursive: true });
  const assetRootReal = await assertDirectory(assetRoot, "asset workspace");
  if (!isInsideDirectory(workspaceRootReal, assetRootReal) || assetRootReal === workspaceRootReal) {
    throw new Error("Resolved Blender asset workspace escapes the workspace through a symbolic link.");
  }

  await mkdir(plan.outputDirectory, { recursive: true });
  const outputDirectoryReal = await assertDirectory(plan.outputDirectory, "export directory");
  if (!isInsideDirectory(assetRootReal, outputDirectoryReal)) {
    throw new Error("Resolved Blender export directory escapes the asset workspace through a symbolic link.");
  }

  const jobsDirectory = path.dirname(plan.stagingDirectory);
  await mkdir(jobsDirectory, { recursive: true });
  const jobsDirectoryReal = await assertDirectory(jobsDirectory, "job cache");
  if (!isInsideDirectory(assetRootReal, jobsDirectoryReal)) {
    throw new Error("Resolved Blender job cache escapes the asset workspace through a symbolic link.");
  }

  try {
    await mkdir(plan.stagingDirectory);
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error("Blender job staging directory already exists.");
    }
    throw error;
  }
  const stagingDirectoryReal = await assertDirectory(plan.stagingDirectory, "job staging directory");
  if (!isInsideDirectory(jobsDirectoryReal, stagingDirectoryReal)) {
    throw new Error("Resolved Blender job staging directory escapes the job cache through a symbolic link.");
  }
}

async function assertSafeInputFile(
  filePath: string,
  workspaceRootReal: string,
  allowExternalInput: boolean
): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== ".blend") {
    throw new Error("Blender input must be a .blend file.");
  }
  const fileInfo = await lstat(resolvedPath).catch(() => null);
  if (!fileInfo?.isFile() || fileInfo.isSymbolicLink()) {
    throw new Error("Blender input must be an existing regular .blend file, not a symbolic link.");
  }
  const realFilePath = await realpath(resolvedPath);
  if (!allowExternalInput && !isInsideDirectory(workspaceRootReal, realFilePath)) {
    throw new Error("Blender input file escapes the workspace through a symbolic link.");
  }
}

export async function assertSafeBlenderScript(scriptPath: string, extensionRoot: string): Promise<void> {
  const resolvedScriptPath = path.resolve(scriptPath);
  const packagedRoot = path.resolve(extensionRoot, "media", "blender");
  const developmentRoot = path.resolve(extensionRoot, "..", "..", "scripts", "blender");
  const allowedRoot = isInsideDirectory(packagedRoot, resolvedScriptPath)
    ? packagedRoot
    : isInsideDirectory(developmentRoot, resolvedScriptPath)
      ? developmentRoot
      : null;
  if (!allowedRoot || path.extname(resolvedScriptPath).toLowerCase() !== ".py") {
    throw new Error("Blender script path is outside the trusted extension script directories.");
  }

  const scriptInfo = await lstat(resolvedScriptPath).catch(() => null);
  if (!scriptInfo?.isFile() || scriptInfo.isSymbolicLink()) {
    throw new Error(`Blender script is missing or is not a regular file: ${path.basename(resolvedScriptPath)}`);
  }
  const [scriptReal, rootReal] = await Promise.all([realpath(resolvedScriptPath), realpath(allowedRoot)]);
  if (!isInsideDirectory(rootReal, scriptReal)) {
    throw new Error("Blender script escapes its trusted directory through a symbolic link.");
  }
}

async function assertDirectory(directoryPath: string, label: string): Promise<string> {
  const info = await lstat(directoryPath).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Blender ${label} must be a regular directory, not a symbolic link.`);
  }
  return realpath(directoryPath);
}

async function publishFileExclusively(sourcePath: string, destinationPath: string): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(destinationPath),
    `.${path.basename(destinationPath)}.${randomUUID()}.finalizing`
  );
  try {
    await copyFile(sourcePath, temporaryPath, fsConstants.COPYFILE_EXCL);
    try {
      await link(temporaryPath, destinationPath);
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") {
        throw new Error(`Blender export destination already exists: ${path.basename(destinationPath)}`);
      }
      throw error;
    }
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      shell: false
    });
    const timeout = setTimeout(() => {
      killer.kill("SIGKILL");
      resolve();
    }, 5000);
    const finish = (): void => {
      clearTimeout(timeout);
      resolve();
    };
    killer.once("error", finish);
    killer.once("close", finish);
  });
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(finish, timeoutMs);
    function finish(): void {
      clearTimeout(timeout);
      child.removeListener("close", finish);
      resolve();
    }
    child.once("close", finish);
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw blenderCancelledError("Blender job was cancelled.");
  }
}

function blenderCancelledError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function readableError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").trim().slice(0, 500);
}

function boundedInteger(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

class BoundedPrefixedLog {
  private readonly captureLimit: number;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly prefix: string;
  private buffer = "";
  private captureBytes = 0;
  private outputBytes = 0;
  private outputTruncated = false;
  captured = "";

  constructor(outputChannel: vscode.OutputChannel, prefix: string, byteLimit: number) {
    this.outputChannel = outputChannel;
    this.prefix = prefix;
    this.captureLimit = byteLimit;
  }

  append(chunk: Buffer | string): void {
    const text = chunk.toString();
    this.capture(text);
    this.buffer += text;

    let newlineIndex = this.buffer.search(/\r?\n/);
    while (newlineIndex >= 0) {
      const newlineLength = this.buffer[newlineIndex] === "\r" ? 2 : 1;
      this.writeLine(this.buffer.slice(0, newlineIndex));
      this.buffer = this.buffer.slice(newlineIndex + newlineLength);
      newlineIndex = this.buffer.search(/\r?\n/);
    }

    while (this.buffer.length > 8192) {
      this.writeLine(`${this.buffer.slice(0, 8192)} …`);
      this.buffer = this.buffer.slice(8192);
    }
  }

  finish(): void {
    if (this.buffer) {
      this.writeLine(this.buffer);
      this.buffer = "";
    }
  }

  private capture(text: string): void {
    const remaining = this.captureLimit - this.captureBytes;
    if (remaining <= 0) {
      return;
    }
    const bytes = Buffer.from(text);
    const kept = bytes.subarray(0, remaining);
    this.captured += kept.toString("utf8");
    this.captureBytes += kept.byteLength;
  }

  private writeLine(line: string): void {
    if (this.outputTruncated) {
      return;
    }
    const rendered = `${this.prefix} ${line}`;
    const renderedBytes = Buffer.byteLength(rendered, "utf8");
    if (this.outputBytes + renderedBytes > this.captureLimit) {
      this.outputChannel.appendLine(`${this.prefix} … output truncated at ${this.captureLimit} bytes …`);
      this.outputTruncated = true;
      return;
    }
    this.outputBytes += renderedBytes;
    this.outputChannel.appendLine(rendered);
  }
}
