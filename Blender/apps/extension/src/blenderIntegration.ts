import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import type { BlenderIntegration, BlenderStatusSnapshot } from "./AvatarWebviewProvider.js";
import { probeBlenderExecutable, runBlenderVersionCommand, type BlenderProbeResult } from "./blenderProbe.js";
import { runBlenderExportJob, type BlenderExportMode, type BlenderExportOutcome } from "./blenderRunner.js";
import { createBlenderSceneFromSvg, type BlenderSvgHandoffResult } from "./blenderHandoff.js";
import { getAvatarConfig, updateAvatarConfig } from "./settings.js";

type BlenderIntegrationOptions = {
  extensionRoot: string;
  outputChannel: vscode.OutputChannel;
  workspaceRootProvider: () => string | undefined;
  assetRootProvider: () => string | undefined;
};

type BlenderExportRequest = {
  blendPath: string;
  modes: BlenderExportMode[];
};

export type BlenderSvgHandoffRequest = { svgPath: string; sourceName: string };

export class BlenderIntegrationController implements BlenderIntegration, vscode.Disposable {
  private status: BlenderStatusSnapshot = {
    availability: "missing",
    busy: false,
    executablePath: null,
    source: null,
    version: null,
    support: "unknown",
    capabilities: [],
    configuredPathInvalid: false,
    message: "Open Blender Tools to detect or choose a local Blender installation."
  };
  private activeController: AbortController | undefined;
  private disposed = false;

  public constructor(private readonly options: BlenderIntegrationOptions) {}

  public getStatus(): BlenderStatusSnapshot {
    return { ...this.status, capabilities: [...this.status.capabilities] };
  }

  public async refresh(): Promise<BlenderStatusSnapshot> {
    return this.runProbe({ configuredPath: getAvatarConfig().blenderPath });
  }

  public async browse(): Promise<BlenderStatusSnapshot> {
    this.assertAvailable();
    const selected = await vscode.window.showOpenDialog({
      title: "Codex Avatar: Choose Blender Executable",
      canSelectFiles: true,
      canSelectFolders: process.platform === "darwin",
      canSelectMany: false,
      ...(process.platform === "win32" ? { filters: { "Blender executable": ["exe"] } } : {})
    });
    const selectedPath = selected?.[0]?.fsPath;
    if (!selectedPath) {
      this.status = { ...this.status, busy: false, message: "No Blender executable was selected." };
      return this.getStatus();
    }

    const executablePath = resolveSelectedBlenderPath(selectedPath);
    const status = await this.runExactProbe(executablePath);
    if (status.availability === "ready" && status.support === "supported") {
      await updateAvatarConfig({ blenderPath: executablePath });
      this.status = { ...status, source: "setting", configuredPathInvalid: false };
    }
    return this.getStatus();
  }

  public async autoDetect(): Promise<BlenderStatusSnapshot> {
    const status = await this.runProbe({ configuredPath: "" });
    if (status.availability === "ready" && status.support === "supported" && status.executablePath) {
      await updateAvatarConfig({ blenderPath: status.executablePath });
      this.status = {
        ...status,
        source: "setting",
        configuredPathInvalid: false,
        message: `${status.version?.label ?? "Blender"} was detected, saved, and is ready.`
      };
    }
    return this.getStatus();
  }

  public async test(): Promise<BlenderStatusSnapshot> {
    const executablePath = this.status.executablePath ?? getAvatarConfig().blenderPath.trim();
    if (!executablePath) {
      this.status = {
        ...this.status,
        availability: "missing",
        busy: false,
        message: "Choose or auto-detect Blender before testing the connection."
      };
      return this.getStatus();
    }

    const status = await this.runExactProbe(executablePath);
    if (status.availability === "ready") {
      this.status = { ...status, message: `${status.version?.label ?? "Blender"} passed the connection test.` };
    }
    return this.getStatus();
  }

  public async cancel(): Promise<BlenderStatusSnapshot> {
    if (!this.activeController) {
      this.status = { ...this.status, busy: false, message: "There is no active Blender process to cancel." };
      return this.getStatus();
    }
    this.activeController.abort();
    this.status = { ...this.status, busy: false, message: "Blender operation cancelled." };
    return this.getStatus();
  }

  public openLog(): void {
    this.options.outputChannel.show(true);
  }

  public async openOutput(): Promise<void> {
    this.assertAvailable();
    const assetRoot = this.options.assetRootProvider();
    if (!assetRoot) throw new Error("Open a workspace folder before opening Blender output.");
    const outputRoot = path.resolve(assetRoot, "exports", "blender");
    if (!isInside(assetRoot, outputRoot)) throw new Error("Blender output must stay inside the avatar workspace.");
    await mkdir(outputRoot, { recursive: true });
    await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outputRoot));
  }

  public async runExports(request: BlenderExportRequest): Promise<BlenderExportOutcome[]> {
    this.assertAvailable();
    const workspaceRoot = this.options.workspaceRootProvider();
    if (!workspaceRoot) throw new Error("Open a workspace folder before exporting Blender assets.");
    if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before running Blender exports.");
    if (this.activeController) throw new Error("Another Blender operation is already running.");

    let connection = this.getStatus();
    if (!connection.executablePath || connection.support !== "supported") connection = await this.refresh();
    if (!connection.executablePath || connection.support !== "supported") {
      throw new Error(connection.message || "A supported Blender installation was not found.");
    }

    const controller = new AbortController();
    this.activeController = controller;
    this.status = { ...connection, busy: true, message: "Blender export is running." };
    try {
      const config = getAvatarConfig();
      const timeoutSeconds = readBlenderTimeoutSeconds();
      const results = await runBlenderExportJob({
        blenderPath: connection.executablePath,
        blendPath: request.blendPath,
        workspaceRoot,
        assetWorkspace: config.assetWorkspace,
        extensionRoot: this.options.extensionRoot,
        modes: request.modes,
        outputChannel: this.options.outputChannel,
        timeoutMs: timeoutSeconds * 1_000,
        signal: controller.signal,
        allowExternalInput: true
      });
      const succeeded = results.filter((result) => result.status === "success").length;
      const failed = results.length - succeeded;
      this.status = {
        ...connection,
        busy: false,
        message:
          failed === 0
            ? `Blender export completed with ${succeeded} validated result${succeeded === 1 ? "" : "s"}.`
            : `Blender export completed: ${succeeded} succeeded and ${failed} failed. Successful files were kept.`
      };
      return results;
    } catch (error) {
      const cancelled = controller.signal.aborted;
      this.status = {
        ...connection,
        availability: cancelled ? connection.availability : "error",
        busy: false,
        message: cancelled ? "Blender export was cancelled." : readableError(error)
      };
      throw error;
    } finally {
      if (this.activeController === controller) this.activeController = undefined;
    }
  }

  public async createSceneFromSvg(request: BlenderSvgHandoffRequest): Promise<BlenderSvgHandoffResult> {
    this.assertAvailable();
    const workspaceRoot = this.options.workspaceRootProvider();
    if (!workspaceRoot) throw new Error("Open a workspace folder before creating a Blender scene.");
    if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before creating a Blender scene.");
    if (this.activeController) throw new Error("Another Blender operation is already running.");
    let connection = this.getStatus();
    if (!connection.executablePath || connection.support !== "supported") connection = await this.refresh();
    if (!connection.executablePath || connection.support !== "supported") {
      throw new Error(connection.message || "A supported Blender installation was not found.");
    }

    const controller = new AbortController();
    this.activeController = controller;
    this.status = { ...connection, busy: true, message: "Creating an editable Blender scene from SVG curves." };
    try {
      const config = getAvatarConfig();
      const result = await createBlenderSceneFromSvg({
        blenderPath: connection.executablePath,
        svgPath: request.svgPath,
        sourceName: request.sourceName,
        workspaceRoot,
        assetWorkspace: config.assetWorkspace,
        extensionRoot: this.options.extensionRoot,
        outputChannel: this.options.outputChannel,
        timeoutMs: readBlenderTimeoutSeconds() * 1_000,
        signal: controller.signal
      });
      this.status = { ...connection, busy: false, message: "Editable Blender SVG scene created." };
      return result;
    } catch (error) {
      const cancelled = controller.signal.aborted;
      this.status = {
        ...connection,
        availability: cancelled ? connection.availability : "error",
        busy: false,
        message: cancelled ? "SVG-to-Blender handoff was cancelled." : readableError(error)
      };
      throw error;
    } finally {
      if (this.activeController === controller) this.activeController = undefined;
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.activeController?.abort();
    this.activeController = undefined;
  }

  private async runExactProbe(executablePath: string): Promise<BlenderStatusSnapshot> {
    const normalizedSelectedPath = normalizeCandidate(executablePath);
    return this.runProbe({
      configuredPath: executablePath,
      environment: {},
      discoverPlatformCandidates: async () => [],
      runVersionCommand: (candidate, timeoutMs, signal) =>
        normalizeCandidate(candidate) === normalizedSelectedPath
          ? runBlenderVersionCommand(candidate, timeoutMs, signal)
          : Promise.reject(new Error("Skipped unrelated Blender fallback candidate."))
    });
  }

  private async runProbe(options: Parameters<typeof probeBlenderExecutable>[0]): Promise<BlenderStatusSnapshot> {
    this.assertAvailable();
    if (this.activeController) throw new Error("Another Blender operation is already running.");
    const controller = new AbortController();
    this.activeController = controller;
    this.status = { ...this.status, availability: "checking", busy: true, message: "Checking Blender identity." };
    try {
      const result = await probeBlenderExecutable({ ...options, signal: controller.signal });
      this.writeProbeLog(result);
      this.status = statusFromProbe(result);
      return this.getStatus();
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        this.status = { ...this.status, busy: false, message: "Blender connection check was cancelled." };
        const cancelled = new Error(this.status.message);
        cancelled.name = "AbortError";
        throw cancelled;
      }
      this.status = {
        ...this.status,
        availability: "error",
        busy: false,
        support: "unknown",
        capabilities: [],
        message: readableError(error)
      };
      throw error;
    } finally {
      if (this.activeController === controller) this.activeController = undefined;
    }
  }

  private writeProbeLog(result: BlenderProbeResult): void {
    for (const attempt of result.attempts) {
      this.options.outputChannel.appendLine(`[Blender probe] ${attempt.source}: ${attempt.state} — ${attempt.message}`);
    }
  }

  private assertAvailable(): void {
    if (this.disposed) throw new Error("Blender Tools have been disposed.");
  }
}

function statusFromProbe(result: BlenderProbeResult): BlenderStatusSnapshot {
  const version = result.version
    ? {
        major: result.version.major,
        minor: result.version.minor,
        patch: result.version.patch,
        label: result.version.raw
      }
    : null;
  const capabilities: BlenderStatusSnapshot["capabilities"] = [];
  if (result.capabilities.svgLineArt) capabilities.push("svg");
  if (result.capabilities.glbExport) capabilities.push("glb");
  if (result.capabilities.pngPreview) capabilities.push("png");

  const configuredPathInvalid = result.configuredPreferenceIssue !== null;
  if (result.supportState === "supported") {
    return {
      availability: "ready",
      busy: false,
      executablePath: result.executablePath,
      source: result.discoverySource,
      version,
      support: "supported",
      capabilities,
      configuredPathInvalid,
      message: configuredPathInvalid
        ? `${version?.label ?? "Blender"} was found, but the saved Blender path needs repair.`
        : `${version?.label ?? "Blender"} is connected and ready.`
    };
  }
  if (result.supportState === "unsupported") {
    return {
      availability: "unsupported",
      busy: false,
      executablePath: result.executablePath,
      source: result.discoverySource,
      version,
      support: "unsupported",
      capabilities: [],
      configuredPathInvalid,
      message: `${version?.label ?? "This Blender version"} is older than the supported minimum Blender 3.6.0.`
    };
  }
  return {
    availability: configuredPathInvalid ? "invalid" : "missing",
    busy: false,
    executablePath: null,
    source: null,
    version: null,
    support: "unknown",
    capabilities: [],
    configuredPathInvalid,
    message: configuredPathInvalid
      ? "The saved Blender path is invalid and no other supported installation was found."
      : "Blender was not found. Install it, choose its executable, or try Auto-detect."
  };
}

function resolveSelectedBlenderPath(selectedPath: string): string {
  const resolved = path.resolve(selectedPath);
  if (process.platform === "darwin" && resolved.toLowerCase().endsWith(".app")) {
    return path.join(resolved, "Contents", "MacOS", "Blender");
  }
  return resolved;
}

function readBlenderTimeoutSeconds(): number {
  const configured = vscode.workspace.getConfiguration("codexAvatar").get<number>("blenderTimeoutSeconds", 120);
  return Number.isFinite(configured) ? Math.max(10, Math.min(600, Math.round(configured))) : 120;
}

function normalizeCandidate(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 500) || "The Blender operation failed.";
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
