import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { VectorizeStage } from "@codex-avatar-studio/asset-pipeline";
import * as vscode from "vscode";
import {
  avatarPackageArchiveFileName,
  exportAvatarPackageArchive,
  licenseNeedsRedistributionWarning
} from "./avatarPackageExport.js";
import {
  type AvatarPackage,
  type AvatarPackageInstallTransaction,
  type AvatarPackageRegistry,
  validateAvatarPackage
} from "./avatarPackages.js";
import type {
  AvatarManifest,
  AvatarState,
  AvatarTrigger,
  ExtensionToWebviewMessage,
  ExtensionToWebviewMessageInput,
  GeneratedAvatarMetadata,
  JsonValue,
  VectorizeStudioOptions,
  WebviewToExtensionMessage
} from "./avatarState.js";
import { createExtensionToWebviewMessage, parseWebviewToExtensionMessage } from "./avatarState.js";
import { stageBlenderSvgPackage } from "./blenderAvatarPackage.js";
import type { BlenderExportOutcome } from "./blenderRunner.js";
import { stageGeneratedSvgPackage } from "./generatedAvatarPackage.js";
import {
  type PicturePreviewJob,
  PictureStudioError,
  type PictureStudioErrorCode,
  PictureStudioSession
} from "./pictureStudio.js";
import { getAvatarConfig, updateAvatarConfig } from "./settings.js";
import { runVectorizationWorker, type VectorizationRunner } from "./vectorizationWorkerRunner.js";

export type BlenderStatusSnapshot = Omit<
  Extract<ExtensionToWebviewMessage, { type: "blender:status" }>,
  "protocolVersion" | "type"
>;

export interface BlenderIntegration {
  getStatus(): BlenderStatusSnapshot;
  refresh(): Promise<BlenderStatusSnapshot>;
  browse(): Promise<BlenderStatusSnapshot>;
  autoDetect(): Promise<BlenderStatusSnapshot>;
  test(): Promise<BlenderStatusSnapshot>;
  cancel(): Promise<BlenderStatusSnapshot>;
  openLog(): Promise<void> | void;
  openOutput(): Promise<void>;
  createSceneFromSvg(request: { svgPath: string; sourceName: string }): Promise<{
    scenePath: string;
    reportPath: string;
  }>;
}

export class AvatarWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "codexAvatar.assistantView";

  private view: vscode.WebviewView | undefined;
  private currentState: AvatarState = "welcome";
  private assetRevision = 0;
  private pictureSelectionInProgress = false;
  private pictureSelectionCancelled = false;
  private readonly pictureStudio: PictureStudioSession;
  private activeVectorization: { jobId: string; revision: number; controller: AbortController } | undefined;
  private packageSaveInProgress = false;
  private packageSaveCancelled = false;
  private libraryOperationInProgress = false;
  private blenderOperationInProgress = false;
  private blenderExportSession: { jobId: string; sourceFileName: string; outcomes: BlenderExportOutcome[] } | undefined;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly packageRegistry?: AvatarPackageRegistry,
    private readonly vectorizationRunner: VectorizationRunner = runVectorizationWorker,
    private readonly blenderIntegration?: BlenderIntegration
  ) {
    this.pictureStudio = new PictureStudioSession(() => this.packageRegistry?.getAssetRoot());
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        ...(this.packageRegistry?.getAssetRoot()
          ? [vscode.Uri.file(this.packageRegistry.getAssetRoot() as string)]
          : [])
      ]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      const parsed = parseWebviewToExtensionMessage(message);
      if (!parsed.success) {
        console.warn("[Codex Avatar] Rejected Webview message", parsed.error.issues);
        return;
      }

      void this.handleWebviewMessage(parsed.data);
    });
    webviewView.onDidDispose(() => {
      if (this.view === webviewView) this.view = undefined;
      this.abortVectorization();
      void this.cancelPictureJob(undefined, "disposed");
      if (this.blenderOperationInProgress) void this.blenderIntegration?.cancel().catch(() => undefined);
    });
  }

  public dispose(): void {
    this.view = undefined;
    this.abortVectorization();
    if (this.packageSaveInProgress) this.packageSaveCancelled = true;
    void this.pictureStudio.clear();
    if (this.blenderOperationInProgress) void this.blenderIntegration?.cancel().catch(() => undefined);
  }

  public postMessage(message: ExtensionToWebviewMessageInput): void {
    void this.view?.webview.postMessage(createExtensionToWebviewMessage(message));
  }

  public setState(state: AvatarState): void {
    this.currentState = state;
    this.postMessage({ type: "avatar:setState", state });
  }

  public trigger(trigger: AvatarTrigger): void {
    this.postMessage({ type: "avatar:trigger", trigger });
  }

  public debugEvent(event: string, payload?: unknown): void {
    const safePayload = toJsonValue(payload);
    this.postMessage(
      safePayload === undefined ? { type: "debug:event", event } : { type: "debug:event", event, payload: safePayload }
    );
  }

  public refreshSettings(): void {
    this.postMessage({ type: "settings:update", config: getAvatarConfig() });
  }

  public async reloadAssets(options: { throwOnError?: boolean } = {}): Promise<void> {
    await this.postActiveManifest(options.throwOnError ?? false);
  }

  public postBlenderStatus(status: BlenderStatusSnapshot = this.getBlenderStatus()): void {
    this.postMessage({ type: "blender:status", ...status });
  }

  public recordBlenderExport(sourceFileName: string, outcomes: BlenderExportOutcome[]): void {
    const jobId = randomUUID();
    this.blenderExportSession = { jobId, sourceFileName: path.basename(sourceFileName), outcomes };
    this.postMessage({
      type: "blender:exportResult",
      jobId,
      sourceFile: path.basename(sourceFileName),
      results: outcomes.map((outcome) =>
        outcome.status === "success"
          ? {
              status: "success" as const,
              mode: outcome.mode,
              fileName: path.basename(outcome.outputPath),
              reportFileName: path.basename(outcome.manifestPath)
            }
          : { status: "failed" as const, mode: outcome.mode, message: outcome.message }
      ),
      canUseAsAvatar: outcomes.some((outcome) => outcome.status === "success" && outcome.mode === "svg")
    });
  }

  public async saveBlenderAvatar(
    jobId: string,
    metadata: GeneratedAvatarMetadata,
    collisionAction: "reject" | "replace" | "copy"
  ): Promise<void> {
    const session = this.blenderExportSession;
    const registry = this.packageRegistry;
    if (!session || session.jobId !== jobId || !registry) {
      this.postMessage({
        type: "blender:avatarSaveStatus",
        jobId,
        tone: "error",
        message: "Run a current Blender SVG export before creating an avatar."
      });
      return;
    }
    if (!vscode.workspace.isTrusted || this.packageSaveInProgress) {
      this.postMessage({
        type: "blender:avatarSaveStatus",
        jobId,
        tone: "warning",
        message: !vscode.workspace.isTrusted
          ? "Trust this workspace before creating an avatar."
          : "Another avatar package operation is still running."
      });
      return;
    }

    this.packageSaveInProgress = true;
    let stagedRoot: string | undefined;
    let transaction: AvatarPackageInstallTransaction | undefined;
    let settingsChanged = false;
    const previousConfig = getAvatarConfig();
    try {
      if (collisionAction === "reject" && (await registry.hasPackageCollision(metadata.id))) {
        this.postMessage({
          type: "blender:avatarSaveStatus",
          jobId,
          tone: "warning",
          message: `Avatar id "${metadata.id}" already exists. Replace it or save a copy.`,
          suggestedCopyId: await registry.suggestAvailableId(metadata.id)
        });
        return;
      }
      const effectiveMetadata =
        collisionAction === "copy" ? { ...metadata, id: await registry.suggestAvailableId(metadata.id) } : metadata;
      this.postMessage({
        type: "blender:avatarSaveStatus",
        jobId,
        tone: "working",
        message: "Validating and installing the Blender SVG avatar locally."
      });
      const assetRoot = registry.getAssetRoot();
      if (!assetRoot) throw new Error("Open a workspace folder before creating an avatar.");
      stagedRoot = await stageBlenderSvgPackage({
        assetRoot,
        sourceFileName: session.sourceFileName,
        outcomes: session.outcomes,
        metadata: effectiveMetadata
      });
      transaction = await registry.beginInstallStagedPackage(stagedRoot, {
        replaceExisting: collisionAction === "replace"
      });
      const replacedExisting = transaction.replacedExisting;
      stagedRoot = undefined;
      settingsChanged = true;
      const runtime = selectPackageRuntime(transaction.avatarPackage.manifest);
      await updateAvatarConfig({ character: transaction.avatarPackage.id, runtime });
      this.refreshSettings();
      await this.reloadAssets({ throwOnError: true });
      await transaction.commit();
      transaction = undefined;
      await this.postAvatarLibrary();
      this.postMessage({
        type: "blender:avatarSaveStatus",
        jobId,
        tone: "success",
        message: `${effectiveMetadata.name} is now the active ${runtime.toUpperCase()} avatar.`,
        avatar: { id: effectiveMetadata.id, name: effectiveMetadata.name, replacedExisting }
      });
      this.setState("success");
      this.trigger("celebrate");
    } catch (error) {
      if (transaction) await transaction.rollback().catch(() => undefined);
      if (stagedRoot) await rm(stagedRoot, { recursive: true, force: true }).catch(() => undefined);
      if (settingsChanged) {
        await updateAvatarConfig({ character: previousConfig.character, runtime: previousConfig.runtime }).catch(
          () => undefined
        );
        this.refreshSettings();
        await this.reloadAssets().catch(() => undefined);
      }
      this.postMessage({
        type: "blender:avatarSaveStatus",
        jobId,
        tone: "error",
        message: boundedErrorMessage(error)
      });
      this.setState("error");
    } finally {
      this.packageSaveInProgress = false;
    }
  }

  public async createBlenderSceneFromCurrentSvg(jobId: string, revision: number): Promise<void> {
    const picture = this.pictureStudio.getCurrentJob();
    const vector = this.pictureStudio.getVectorPreview(jobId, revision);
    if (!picture || picture.jobId !== jobId || !vector || !this.blenderIntegration) {
      this.postMessage({
        type: "blender:handoffStatus",
        jobId,
        revision,
        tone: "error",
        message: "Generate a current SVG preview and connect Blender before creating a scene."
      });
      return;
    }
    if (!vscode.workspace.isTrusted) {
      this.postMessage({
        type: "blender:handoffStatus",
        jobId,
        revision,
        tone: "warning",
        message: "Trust this workspace before creating a Blender scene."
      });
      return;
    }
    this.postMessage({
      type: "blender:handoffStatus",
      jobId,
      revision,
      tone: "working",
      message: "Importing sanitized SVG curves into a new Blender working scene."
    });
    this.postBlenderStatus({ ...this.blenderIntegration.getStatus(), busy: true, message: "Creating Blender scene." });
    this.setState("building");
    try {
      const result = await this.blenderIntegration.createSceneFromSvg({
        svgPath: vector.previewPath,
        sourceName: picture.fileName
      });
      this.postBlenderStatus(this.blenderIntegration.getStatus());
      this.postMessage({
        type: "blender:handoffStatus",
        jobId,
        revision,
        tone: "success",
        message: "Editable Blender starting scene created. Curves are not an automatic rig or 3D character.",
        sceneFileName: path.basename(result.scenePath),
        reportFileName: path.basename(result.reportPath)
      });
      this.setState("success");
    } catch (error) {
      this.postBlenderStatus(this.blenderIntegration.getStatus());
      this.postMessage({
        type: "blender:handoffStatus",
        jobId,
        revision,
        tone: error instanceof Error && error.name === "AbortError" ? "warning" : "error",
        message: boundedErrorMessage(error)
      });
      this.setState("error");
    }
  }

  public async choosePicture(): Promise<void> {
    const view = this.view;
    if (!view) {
      vscode.window.showWarningMessage("Open the Codex Avatar assistant before choosing a picture.");
      return;
    }
    if (this.pictureSelectionInProgress) {
      this.postPictureError("busy", "A picture picker or preview job is already in progress.", true);
      return;
    }
    if (this.activeVectorization) {
      this.postPictureError("busy", "Cancel the SVG conversion before choosing another picture.", true);
      return;
    }
    if (this.packageSaveInProgress) {
      this.postPictureError(
        "busy",
        "Wait for the avatar package save to finish before choosing another picture.",
        true
      );
      return;
    }
    if (!vscode.workspace.isTrusted) {
      this.postPictureError(
        "workspace-untrusted",
        "Trust this workspace before creating an avatar from a local picture.",
        true
      );
      return;
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.postPictureError(
        "workspace-required",
        "Open a folder with File > Open Folder before creating an avatar, then try again.",
        true
      );
      return;
    }

    this.pictureSelectionInProgress = true;
    this.pictureSelectionCancelled = false;
    this.postMessage({
      type: "studio:imageProgress",
      stage: "selecting",
      message: "Choose a local PNG or JPG picture.",
      progress: 0.1
    });

    try {
      const selectedFiles = await vscode.window.showOpenDialog({
        title: "Codex Avatar: Create Avatar from Picture",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { "PNG or JPG picture": ["png", "jpg", "jpeg"] }
      });
      const selectedFile = selectedFiles?.[0];
      if (this.pictureSelectionCancelled || this.view !== view) return;
      if (!selectedFile) {
        this.postMessage({ type: "studio:imageCancelled", reason: "picker" });
        return;
      }

      this.setState("building");
      const job = await this.pictureStudio.preparePreview(
        selectedFile.fsPath,
        workspaceFolder.uri.fsPath,
        (stage, jobId) => {
          this.postMessage({
            type: "studio:imageProgress",
            ...(jobId ? { jobId } : {}),
            stage,
            message: stage === "validating" ? "Checking picture safety and dimensions." : "Preparing local preview.",
            progress: stage === "validating" ? 0.45 : 0.75
          });
        }
      );
      if (this.pictureSelectionCancelled || this.view !== view) {
        await this.pictureStudio.clear(job.jobId);
        return;
      }
      this.postPictureSelection(job, view.webview);
      this.setState("reviewing");
    } catch (error) {
      const code = error instanceof PictureStudioError ? error.code : "unknown";
      this.postPictureError(code, error instanceof Error ? error.message : String(error), true);
      this.setState("error");
    } finally {
      this.pictureSelectionInProgress = false;
    }
  }

  public async vectorizePicture(jobId: string, revision: number, options: VectorizeStudioOptions): Promise<void> {
    const view = this.view;
    const job = this.pictureStudio.getCurrentJob();
    if (!view || !job || job.jobId !== jobId) {
      this.postVectorError(jobId, revision, "trace-failed", "The selected picture is no longer available.", true);
      return;
    }
    if (!vscode.workspace.isTrusted) {
      this.postVectorError(
        jobId,
        revision,
        "trace-failed",
        "Trust this workspace before converting the picture.",
        true
      );
      return;
    }
    if (this.activeVectorization) {
      this.postVectorError(jobId, revision, "trace-failed", "An SVG conversion is already running.", true);
      return;
    }

    const controller = new AbortController();
    const active = { jobId, revision, controller };
    this.activeVectorization = active;
    this.setState("building");

    try {
      const preview = await this.vectorizationRunner(
        vscode.Uri.joinPath(this.extensionUri, "dist", "vectorizeWorker.js").fsPath,
        {
          inputPath: job.previewPath,
          workspaceRoot: job.workspaceRoot,
          outputBaseName: path.parse(job.fileName).name,
          preprocessing: {
            grayscale: options.grayscale,
            quantizationLevels: options.colorCount,
            removeBackground: options.removeNearWhite,
            noiseReduction: options.noiseReduction,
            detail: options.detail,
            ...(options.threshold === null ? {} : { threshold: options.threshold })
          },
          maxSvgBytes: 1_000_000,
          maxSvgPaths: 20_000
        },
        controller.signal,
        (stage) => {
          if (this.activeVectorization !== active || this.view !== view) return;
          const progress = vectorProgress(stage);
          this.postMessage({
            type: "studio:vectorProgress",
            jobId,
            revision,
            stage,
            message: progress.message,
            progress: progress.value
          });
        }
      );
      throwIfCancelled(controller.signal);
      if (this.activeVectorization !== active || this.pictureStudio.getCurrentJob()?.jobId !== jobId) return;

      this.postMessage({
        type: "studio:vectorProgress",
        jobId,
        revision,
        stage: "writing",
        message: "Preparing the safe local SVG preview.",
        progress: 0.95
      });
      const svgPreviewPath = await this.pictureStudio.storeVectorPreview(jobId, revision, preview.optimizedSvg);
      throwIfCancelled(controller.signal);
      if (this.activeVectorization !== active || this.view !== view) {
        await this.pictureStudio.clearVectorPreview(jobId);
        return;
      }

      const previewUri = appendUriQuery(
        view.webview.asWebviewUri(vscode.Uri.file(svgPreviewPath)).toString(),
        "codexAvatarVectorRevision",
        String(revision)
      );
      this.postMessage({
        type: "studio:vectorPreview",
        jobId,
        revision,
        previewUri,
        metrics: {
          rawByteSize: preview.rawValidation.byteLength,
          optimizedByteSize: preview.optimizedValidation.byteLength,
          pathCount: preview.optimizedValidation.pathCount,
          groupCount: preview.optimizedValidation.groupCount,
          tinyPathCount: preview.optimizedValidation.tinyPathCount,
          missingLayers: boundedMessages(preview.optimizedValidation.missingLayers, 120),
          warnings: boundedMessages(preview.warnings, 500)
        }
      });
      this.setState("reviewing");
    } catch (error) {
      await this.pictureStudio.clearVectorPreview(jobId).catch(() => undefined);
      if (error instanceof Error && error.name === "AbortError") {
        if (this.view === view && this.pictureStudio.getCurrentJob()?.jobId === jobId) {
          this.postMessage({ type: "studio:vectorCancelled", jobId, revision });
          this.setState("reviewing");
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.postVectorError(jobId, revision, classifyVectorError(message), message, true);
        this.setState("error");
      }
    } finally {
      if (this.activeVectorization === active) this.activeVectorization = undefined;
    }
  }

  public async cancelVectorization(jobId: string, revision: number): Promise<void> {
    const active = this.activeVectorization;
    if (!active || active.jobId !== jobId || active.revision !== revision) return;
    active.controller.abort();
    await this.pictureStudio.clearVectorPreview(jobId);
  }

  public async saveGeneratedAvatar(
    jobId: string,
    revision: number,
    metadata: GeneratedAvatarMetadata,
    collisionAction: "reject" | "replace" | "copy"
  ): Promise<void> {
    const view = this.view;
    const registry = this.packageRegistry;
    const picture = this.pictureStudio.getCurrentJob();
    const vector = this.pictureStudio.getVectorPreview(jobId, revision);
    if (!view || !registry || !picture || picture.jobId !== jobId || !vector) {
      this.postPackageError(
        jobId,
        revision,
        "validation-failed",
        "Generate a current SVG preview before saving.",
        true
      );
      return;
    }
    if (!vscode.workspace.isTrusted) {
      this.postPackageError(
        jobId,
        revision,
        "activation-failed",
        "Trust this workspace before saving an avatar.",
        true
      );
      return;
    }
    if (this.packageSaveInProgress || this.activeVectorization) {
      this.postPackageError(jobId, revision, "install-failed", "Another Studio operation is still running.", true);
      return;
    }

    this.packageSaveInProgress = true;
    this.packageSaveCancelled = false;
    let stagedRoot: string | undefined;
    let transaction: AvatarPackageInstallTransaction | undefined;
    const previousConfig = getAvatarConfig();
    let settingsChanged = false;
    let replacedExisting = false;
    let failureCode: "validation-failed" | "install-failed" | "activation-failed" | "reload-failed" =
      "validation-failed";
    try {
      if (collisionAction === "reject" && (await registry.hasPackageCollision(metadata.id))) {
        this.postMessage({
          type: "studio:packageCollision",
          jobId,
          revision,
          id: metadata.id,
          suggestedCopyId: await registry.suggestAvailableId(metadata.id)
        });
        return;
      }

      const effectiveMetadata =
        collisionAction === "copy" ? { ...metadata, id: await registry.suggestAvailableId(metadata.id) } : metadata;
      this.postPackageProgress(jobId, revision, "staging", "Creating the local avatar package.", 0.15);
      const assetRoot = registry.getAssetRoot();
      if (!assetRoot) throw new Error("Open a workspace folder before saving an avatar.");
      stagedRoot = await stageGeneratedSvgPackage({ assetRoot, picture, vector, metadata: effectiveMetadata });
      throwIfPackageSaveCancelled(this.packageSaveCancelled || this.view !== view);
      this.postPackageProgress(jobId, revision, "validating", "Validating manifest, SVG, paths, and checksums.", 0.4);

      failureCode = "install-failed";
      this.postPackageProgress(jobId, revision, "installing", "Installing the validated avatar atomically.", 0.62);
      transaction = await registry.beginInstallStagedPackage(stagedRoot, {
        replaceExisting: collisionAction === "replace"
      });
      throwIfPackageSaveCancelled(this.packageSaveCancelled || this.view !== view);
      replacedExisting = transaction.replacedExisting;
      stagedRoot = undefined;

      failureCode = "activation-failed";
      this.postPackageProgress(jobId, revision, "activating", "Selecting the new SVG avatar.", 0.78);
      settingsChanged = true;
      await updateAvatarConfig({ character: transaction.avatarPackage.id, runtime: "svg" });
      throwIfPackageSaveCancelled(this.packageSaveCancelled || this.view !== view);
      this.refreshSettings();

      failureCode = "reload-failed";
      this.postPackageProgress(jobId, revision, "reloading", "Loading the new avatar in the Studio.", 0.92);
      await this.reloadAssets({ throwOnError: true });
      throwIfPackageSaveCancelled(this.packageSaveCancelled || this.view !== view);
      await transaction.commit();
      transaction = undefined;
      await this.pictureStudio.clear(jobId);
      await this.postAvatarLibrary();

      this.postMessage({
        type: "studio:packageSaved",
        jobId,
        revision,
        avatar: {
          id: effectiveMetadata.id,
          name: effectiveMetadata.name,
          replacedExisting
        }
      });
      this.setState("success");
      this.trigger("celebrate");
    } catch (error) {
      if (transaction) await transaction.rollback().catch(() => undefined);
      if (stagedRoot) await rm(stagedRoot, { recursive: true, force: true }).catch(() => undefined);
      if (settingsChanged) {
        await updateAvatarConfig({ character: previousConfig.character, runtime: previousConfig.runtime }).catch(
          () => undefined
        );
        this.refreshSettings();
        await this.reloadAssets().catch(() => undefined);
      }
      const message = error instanceof Error ? error.message : String(error);
      const classified = classifyPackageError(message);
      this.postPackageError(jobId, revision, classified === "unknown" ? failureCode : classified, message, true);
      this.setState("error");
    } finally {
      this.packageSaveInProgress = false;
      this.packageSaveCancelled = false;
    }
  }

  public async postAvatarLibrary(): Promise<boolean> {
    const workspaceAvailable = Boolean(vscode.workspace.workspaceFolders?.[0] && this.packageRegistry?.getAssetRoot());
    const workspaceTrusted = vscode.workspace.isTrusted;
    let activeId: string | undefined;
    const avatars: Array<{
      id: string;
      name: string;
      author: string;
      license: string;
      version: string;
      runtime: "svg" | "pixi" | "webgl";
      active: boolean;
      builtIn: boolean;
      valid: boolean;
      errorCount: number;
      warningCount: number;
    }> = [];

    let refreshSucceeded = true;
    if (workspaceAvailable && workspaceTrusted && this.packageRegistry) {
      try {
        activeId = await this.packageRegistry.getActiveId();
        const records = await this.packageRegistry.listPackageRecords();
        for (const record of records.slice(0, 255)) {
          const manifest = record.validation.manifest;
          avatars.push({
            id: record.id.slice(0, 255),
            name: (manifest?.name ?? record.id).slice(0, 255),
            author: (manifest?.author ?? "Unknown author").slice(0, 255),
            license: (manifest?.license ?? "Unknown rights status").slice(0, 255),
            version: (manifest?.version ?? "Unknown").slice(0, 160),
            runtime: manifest ? selectPackageRuntime(manifest) : "svg",
            active: record.id === activeId,
            builtIn: false,
            valid: record.validation.valid,
            errorCount: Math.min(128, record.validation.errors.length),
            warningCount: Math.min(128, record.validation.warnings.length)
          });
        }
      } catch (error) {
        refreshSucceeded = false;
        console.warn("[Codex Avatar] Avatar library refresh failed", error);
        this.postLibraryStatus(
          "refresh",
          "error",
          "The avatar library could not be read. Check the workspace package files and try again."
        );
      }
    }

    avatars.unshift({
      id: "default-coder-orb",
      name: "Default Coder Orb",
      author: "Codex Avatar Studio contributors",
      license: "UNLICENSED (original project work)",
      version: "0.1.0",
      runtime: "svg",
      active: !activeId,
      builtIn: true,
      valid: true,
      errorCount: 0,
      warningCount: 0
    });
    this.postMessage({
      type: "library:updated",
      workspaceAvailable,
      workspaceTrusted,
      activeId: activeId ?? null,
      avatars
    });
    return refreshSucceeded;
  }

  private async importAvatarFromLibrary(): Promise<void> {
    await this.runLibraryOperation("import", async () => {
      this.requireTrustedLibraryWorkspace();
      const selected = await vscode.window.showOpenDialog({
        title: "Codex Avatar: Import Avatar Package",
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        filters: { "Avatar package manifest": ["json"] }
      });
      const source = selected?.[0];
      if (!source) return "Import cancelled; no files were changed.";
      const imported = await this.packageRegistry?.importPackage(source.fsPath);
      return imported ? `Imported ${imported.manifest.name}. Select it in the library to use it.` : "Import failed.";
    });
  }

  private async activateLibraryAvatar(id: string | null): Promise<void> {
    await this.runLibraryOperation("activate", async () => {
      this.requireTrustedLibraryWorkspace();
      const registry = this.packageRegistry as AvatarPackageRegistry;
      const previousId = await registry.getActiveId();
      const previousConfig = getAvatarConfig();
      const avatarPackage = id ? await registry.getPackage(id) : undefined;
      const runtime = avatarPackage ? selectPackageRuntime(avatarPackage.manifest) : "svg";
      try {
        await registry.activateAvatar(id ?? undefined);
        await updateAvatarConfig({ character: id ?? "default", runtime });
        this.refreshSettings();
        await this.reloadAssets({ throwOnError: true });
      } catch (error) {
        await registry.activateAvatar(previousId).catch(() => undefined);
        await updateAvatarConfig({ character: previousConfig.character, runtime: previousConfig.runtime }).catch(
          () => undefined
        );
        this.refreshSettings();
        await this.reloadAssets().catch(() => undefined);
        throw error;
      }
      return `Active avatar: ${avatarPackage?.manifest.name ?? "Default Coder Orb"}.`;
    });
  }

  private async validateLibraryAvatar(id: string | null): Promise<void> {
    await this.runLibraryOperation("validate", async () => {
      if (id) this.requireTrustedLibraryWorkspace();
      const validation = id
        ? await this.packageRegistry?.validateRegisteredPackage(id)
        : await validateAvatarPackage(vscode.Uri.joinPath(this.extensionUri, "media", "avatars").fsPath);
      if (!validation) throw new Error("Avatar validation is unavailable.");
      this.postMessage({
        type: "library:validationResult",
        id: id ?? "default-coder-orb",
        valid: validation.valid,
        errors: this.redactLibraryDetails(validation.errors),
        warnings: this.redactLibraryDetails(validation.warnings)
      });
      return validation.valid
        ? `Validation passed with ${validation.warnings.length} warning(s).`
        : `Validation found ${validation.errors.length} error(s).`;
    });
  }

  private async reloadLibraryAvatar(): Promise<void> {
    await this.runLibraryOperation("reload", async () => {
      await this.reloadAssets({ throwOnError: true });
      return "Avatar assets reloaded.";
    });
  }

  private async revealLibraryAvatar(id: string | null): Promise<void> {
    await this.runLibraryOperation("reveal", async () => {
      if (id) this.requireTrustedLibraryWorkspace();
      const rootPath = id
        ? (await this.packageRegistry?.getPackage(id))?.rootPath
        : vscode.Uri.joinPath(this.extensionUri, "media", "avatars").fsPath;
      if (!rootPath) throw new Error("Avatar folder is unavailable.");
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(rootPath));
      return "Opened the avatar folder.";
    });
  }

  private async exportLibraryAvatar(id: string): Promise<void> {
    await this.runLibraryOperation("export", async () => {
      this.requireTrustedLibraryWorkspace();
      const avatarPackage = await this.packageRegistry?.getPackage(id);
      if (!avatarPackage) throw new Error("Avatar package is unavailable.");

      const validation = await this.packageRegistry?.validateRegisteredPackage(id);
      if (!validation?.valid) {
        throw new Error("Validate and repair this avatar package before exporting it.");
      }

      const restricted = licenseNeedsRedistributionWarning(avatarPackage.manifest.license);
      const confirmation = await vscode.window.showWarningMessage(
        restricted
          ? `The rights statement for “${avatarPackage.manifest.name}” may not permit redistribution.`
          : `Export “${avatarPackage.manifest.name}” as a shareable avatar package?`,
        {
          modal: true,
          detail: restricted
            ? `Current license / rights statement: ${avatarPackage.manifest.license}\n\nExport only as a local backup unless you own the artwork or have permission to redistribute it.`
            : `Author: ${avatarPackage.manifest.author}\nLicense / rights: ${avatarPackage.manifest.license}\n\nConfirm that these rights cover how you plan to share or publish the package.`
        },
        restricted ? "Export Local Backup" : "Export Package"
      );
      if (!confirmation) return "Export cancelled; no files were changed.";

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!workspaceRoot) throw new Error("Open a workspace folder before exporting an avatar package.");
      const selected = await vscode.window.showSaveDialog({
        title: "Codex Avatar: Export Avatar Package",
        defaultUri: vscode.Uri.joinPath(workspaceRoot, avatarPackageArchiveFileName(avatarPackage.manifest)),
        filters: { "Codex Avatar package ZIP": ["zip"] },
        saveLabel: "Export Avatar"
      });
      if (!selected) return "Export cancelled; no files were changed.";

      const destinationPath = selected.fsPath.toLowerCase().endsWith(".zip")
        ? selected.fsPath
        : `${selected.fsPath}.zip`;
      const result = await exportAvatarPackageArchive(avatarPackage.rootPath, destinationPath);
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(result.archivePath));
      return `Exported ${avatarPackage.manifest.name} as ${path.basename(result.archivePath)}. Unzip it before using Import Avatar.`;
    });
  }

  private async removeLibraryAvatar(id: string): Promise<void> {
    await this.runLibraryOperation("remove", async () => {
      this.requireTrustedLibraryWorkspace();
      const registry = this.packageRegistry as AvatarPackageRegistry;
      const previousConfig = getAvatarConfig();
      const wasActive = (await registry.getActiveId()) === id;
      if (wasActive) {
        try {
          await registry.activateAvatar(undefined);
          await updateAvatarConfig({ character: "default", runtime: "svg" });
          this.refreshSettings();
          await this.reloadAssets({ throwOnError: true });
        } catch (error) {
          await registry.activateAvatar(id).catch(() => undefined);
          await updateAvatarConfig({ character: previousConfig.character, runtime: previousConfig.runtime }).catch(
            () => undefined
          );
          this.refreshSettings();
          await this.reloadAssets().catch(() => undefined);
          throw error;
        }
      }
      try {
        await registry.removeAvatar(id);
      } catch (error) {
        if (wasActive) {
          await registry.activateAvatar(id).catch(() => undefined);
          await updateAvatarConfig({ character: previousConfig.character, runtime: previousConfig.runtime }).catch(
            () => undefined
          );
          this.refreshSettings();
          await this.reloadAssets().catch(() => undefined);
        }
        throw error;
      }
      return `Removed avatar package ${id}.`;
    });
  }

  private async runLibraryOperation(
    operation: "refresh" | "import" | "activate" | "validate" | "reload" | "reveal" | "export" | "remove",
    action: () => Promise<string>
  ): Promise<void> {
    if (this.libraryOperationInProgress) {
      this.postLibraryStatus(operation, "warning", "Another avatar library action is still running.");
      return;
    }
    this.libraryOperationInProgress = true;
    this.postLibraryStatus(operation, "working", `${operation[0]?.toUpperCase()}${operation.slice(1)} in progress…`);
    try {
      const message = await action();
      this.postLibraryStatus(operation, /cancelled/i.test(message) ? "warning" : "success", message);
    } catch (error) {
      console.warn(`[Codex Avatar] Avatar library ${operation} failed`, error);
      this.postLibraryStatus(operation, "error", libraryOperationFailureMessage(operation));
    } finally {
      this.libraryOperationInProgress = false;
      await this.postAvatarLibrary();
    }
  }

  private requireTrustedLibraryWorkspace(): void {
    if (!vscode.workspace.workspaceFolders?.[0] || !this.packageRegistry?.getAssetRoot()) {
      throw new Error("Open a workspace folder before managing avatar packages.");
    }
    if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before managing avatar packages.");
  }

  private redactLibraryDetails(messages: string[]): string[] {
    const roots = [
      this.packageRegistry?.getAssetRoot(),
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      this.extensionUri.fsPath
    ].filter((root): root is string => Boolean(root));
    return boundedMessages(
      messages.map((message) => redactKnownLocalPaths(message, roots)),
      500
    );
  }

  private getBlenderStatus(): BlenderStatusSnapshot {
    if (!vscode.workspace.workspaceFolders?.[0]) {
      return unavailableBlenderStatus("Open a project folder before setting up Blender Tools.");
    }
    if (!vscode.workspace.isTrusted) {
      return unavailableBlenderStatus("Trust this workspace before running or configuring Blender.");
    }
    return (
      this.blenderIntegration?.getStatus() ??
      unavailableBlenderStatus("Blender Tools are unavailable in this extension session.")
    );
  }

  private async refreshBlenderStatus(): Promise<void> {
    if (!this.blenderIntegration) {
      this.postBlenderStatus();
      return;
    }
    if (!this.requireTrustedBlenderWorkspace()) {
      this.postBlenderStatus();
      return;
    }
    if (this.blenderOperationInProgress) {
      this.postBlenderStatus(this.blenderIntegration.getStatus());
      return;
    }

    this.blenderOperationInProgress = true;
    this.postBlenderStatus(checkingBlenderStatus(this.blenderIntegration.getStatus(), "Checking Blender setup."));
    try {
      this.postBlenderStatus(await this.blenderIntegration.refresh());
    } catch (error) {
      this.postBlenderStatus(failedBlenderStatus(this.blenderIntegration.getStatus(), boundedErrorMessage(error)));
    } finally {
      this.blenderOperationInProgress = false;
    }
  }

  private async runBlenderOperation(
    operation: "browse" | "detect" | "test",
    action: () => Promise<BlenderStatusSnapshot>
  ): Promise<void> {
    if (!this.blenderIntegration) {
      this.postBlenderOperation(operation, "error", "Blender Tools are unavailable in this extension session.");
      this.postBlenderStatus();
      return;
    }
    if (!this.requireTrustedBlenderWorkspace()) {
      this.postBlenderOperation(operation, "warning", this.getBlenderStatus().message);
      this.postBlenderStatus();
      return;
    }
    if (this.blenderOperationInProgress) {
      this.postBlenderOperation(operation, "warning", "Another Blender operation is already running.");
      return;
    }

    this.blenderOperationInProgress = true;
    const progressMessage = blenderOperationProgressMessage(operation);
    this.postBlenderOperation(operation, "working", progressMessage);
    this.postBlenderStatus(checkingBlenderStatus(this.blenderIntegration.getStatus(), progressMessage));
    try {
      const status = await action();
      this.postBlenderStatus(status);
      this.postBlenderOperation(operation, blenderStatusTone(status), status.message);
    } catch (error) {
      const message = boundedErrorMessage(error);
      const cancelled = isAbortError(error);
      const status = failedBlenderStatus(this.blenderIntegration.getStatus(), message, cancelled);
      this.postBlenderStatus(status);
      this.postBlenderOperation(operation, cancelled ? "warning" : "error", message);
    } finally {
      this.blenderOperationInProgress = false;
    }
  }

  private async cancelBlenderOperation(): Promise<void> {
    if (!this.blenderIntegration) {
      this.postBlenderOperation("cancel", "warning", "There is no Blender operation to cancel.");
      return;
    }
    try {
      this.postBlenderOperation("cancel", "working", "Stopping the active Blender process.");
      const status = await this.blenderIntegration.cancel();
      this.postBlenderStatus(status);
      this.postBlenderOperation("cancel", "success", "Blender operation cancelled.");
    } catch (error) {
      this.postBlenderOperation("cancel", "error", boundedErrorMessage(error));
    }
  }

  private async openBlenderLog(): Promise<void> {
    if (!this.blenderIntegration) {
      this.postBlenderOperation("openLog", "warning", "The Blender output log is not available.");
      return;
    }
    try {
      await this.blenderIntegration.openLog();
      this.postBlenderOperation("openLog", "success", "Opened the Blender output log.");
    } catch (error) {
      this.postBlenderOperation("openLog", "error", boundedErrorMessage(error));
    }
  }

  private async openBlenderOutput(): Promise<void> {
    if (!this.blenderIntegration || !this.requireTrustedBlenderWorkspace()) {
      this.postBlenderOperation("openOutput", "warning", this.getBlenderStatus().message);
      return;
    }
    try {
      await this.blenderIntegration.openOutput();
      this.postBlenderOperation("openOutput", "success", "Opened the workspace Blender output folder.");
    } catch (error) {
      this.postBlenderOperation("openOutput", "error", boundedErrorMessage(error));
    }
  }

  private requireTrustedBlenderWorkspace(): boolean {
    return Boolean(vscode.workspace.workspaceFolders?.[0] && vscode.workspace.isTrusted);
  }

  private postBlenderOperation(
    operation: "browse" | "detect" | "test" | "cancel" | "openLog" | "openOutput",
    tone: "working" | "success" | "warning" | "error",
    message: string
  ): void {
    this.postMessage({ type: "blender:operation", operation, tone, message: message.slice(0, 500) });
  }

  public async cancelPictureJob(jobId?: string, reason: "user" | "disposed" = "user"): Promise<void> {
    if (this.pictureSelectionInProgress) this.pictureSelectionCancelled = true;
    if (this.packageSaveInProgress) this.packageSaveCancelled = true;
    this.abortVectorization(jobId);
    const currentJobId = this.pictureStudio.getCurrentJob()?.jobId;
    const cleared = await this.pictureStudio.clear(jobId);
    if (cleared || !jobId) {
      this.postMessage({
        type: "studio:imageCancelled",
        ...(currentJobId ? { jobId: currentJobId } : {}),
        reason
      });
      if (reason === "user") this.setState("idle");
    }
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case "webview:ready":
        this.refreshSettings();
        await this.postActiveManifest();
        await this.postAvatarLibrary();
        this.postBlenderStatus();
        this.setState(this.currentState);
        break;
      case "command:toggleAssistant":
        await vscode.commands.executeCommand("codexAvatar.toggleAssistant");
        break;
      case "command:resetSettings":
        await vscode.commands.executeCommand("codexAvatar.resetSettings");
        break;
      case "command:openAssetsFolder":
        await vscode.commands.executeCommand("codexAvatar.openAssetsFolder");
        break;
      case "command:reloadAvatar":
        await vscode.commands.executeCommand("codexAvatar.reloadAvatar");
        break;
      case "command:vectorizeImage":
        await vscode.commands.executeCommand("codexAvatar.vectorizeImage");
        break;
      case "command:exportBlender":
        await vscode.commands.executeCommand("codexAvatar.exportBlenderScene");
        break;
      case "studio:chooseImage":
        await vscode.commands.executeCommand("codexAvatar.createFromPicture");
        break;
      case "studio:cancelImageJob":
        await this.cancelPictureJob(message.jobId);
        break;
      case "studio:vectorizeImage":
        await this.vectorizePicture(message.jobId, message.revision, message.options);
        break;
      case "studio:cancelVectorization":
        await this.cancelVectorization(message.jobId, message.revision);
        break;
      case "studio:saveAvatar":
        await this.saveGeneratedAvatar(message.jobId, message.revision, message.metadata, message.collisionAction);
        break;
      case "studio:revealAvatar": {
        const avatarPackage = await this.packageRegistry?.getPackage(message.id);
        if (avatarPackage)
          await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(avatarPackage.rootPath));
        break;
      }
      case "studio:copyAvatarPath": {
        const avatarPackage = await this.packageRegistry?.getPackage(message.id);
        if (avatarPackage) await vscode.env.clipboard.writeText(avatarPackage.rootPath);
        break;
      }
      case "library:refresh":
        if (await this.postAvatarLibrary()) {
          this.postLibraryStatus("refresh", "success", "Avatar library refreshed.");
        }
        break;
      case "library:import":
        await this.importAvatarFromLibrary();
        break;
      case "library:activate":
        await this.activateLibraryAvatar(message.id);
        break;
      case "library:validate":
        await this.validateLibraryAvatar(message.id);
        break;
      case "library:reload":
        await this.reloadLibraryAvatar();
        break;
      case "library:reveal":
        await this.revealLibraryAvatar(message.id);
        break;
      case "library:export":
        await this.exportLibraryAvatar(message.id);
        break;
      case "library:remove":
        await this.removeLibraryAvatar(message.id);
        break;
      case "library:openWorkspace":
        await vscode.commands.executeCommand(
          vscode.workspace.workspaceFolders?.[0] ? "workbench.trust.manage" : "workbench.action.files.openFolder"
        );
        break;
      case "blender:refresh":
        await this.refreshBlenderStatus();
        break;
      case "blender:browse":
        await this.runBlenderOperation("browse", () => (this.blenderIntegration as BlenderIntegration).browse());
        break;
      case "blender:autoDetect":
        await this.runBlenderOperation("detect", () => (this.blenderIntegration as BlenderIntegration).autoDetect());
        break;
      case "blender:test":
        await this.runBlenderOperation("test", () => (this.blenderIntegration as BlenderIntegration).test());
        break;
      case "blender:cancel":
        await this.cancelBlenderOperation();
        break;
      case "blender:openLog":
        await this.openBlenderLog();
        break;
      case "blender:openOutput":
        await this.openBlenderOutput();
        break;
      case "blender:saveAvatar":
        await this.saveBlenderAvatar(message.jobId, message.metadata, message.collisionAction);
        break;
      case "blender:createSceneFromSvg":
        await this.createBlenderSceneFromCurrentSvg(message.jobId, message.revision);
        break;
      case "settings:update":
        await updateAvatarConfig(message.config);
        this.refreshSettings();
        break;
      case "debug:log":
        console.log("[Codex Avatar]", message.message, message.payload ?? "");
        break;
    }
  }

  private async postActiveManifest(throwOnError = false): Promise<void> {
    const view = this.view;
    if (!view) return;
    const assetRevision = ++this.assetRevision;

    try {
      const activePackage = vscode.workspace.isTrusted ? await this.packageRegistry?.getActivePackage() : undefined;
      const manifest = activePackage
        ? createWebviewManifest(activePackage, view.webview, assetRevision)
        : this.createDefaultManifest(view.webview, assetRevision);
      this.postMessage({ type: "assets:manifestLoaded", manifest });
    } catch (error) {
      this.debugEvent("avatar_package_invalid", { message: error instanceof Error ? error.message : String(error) });
      this.postMessage({
        type: "assets:manifestLoaded",
        manifest: this.createDefaultManifest(view.webview, assetRevision)
      });
      if (throwOnError) throw error;
    }
  }

  private postPictureSelection(job: PicturePreviewJob, webview: vscode.Webview): void {
    const assetRoot = this.packageRegistry?.getAssetRoot();
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        ...(assetRoot ? [vscode.Uri.file(assetRoot)] : [])
      ]
    };
    const previewUri = appendUriQuery(
      webview.asWebviewUri(vscode.Uri.file(job.previewPath)).toString(),
      "codexAvatarPictureJob",
      job.jobId
    );
    this.postMessage({
      type: "studio:imageSelected",
      selection: {
        jobId: job.jobId,
        previewUri,
        fileName: job.fileName,
        width: job.width,
        height: job.height,
        fileSize: job.fileSize,
        format: job.format,
        hasAlpha: job.hasAlpha,
        sourceKind: job.sourceKind
      }
    });
  }

  private postPictureError(
    code: PictureStudioErrorCode | "workspace-untrusted" | "busy" | "unknown",
    message: string,
    recoverable: boolean,
    jobId?: string
  ): void {
    this.postMessage({
      type: "studio:imageError",
      ...(jobId ? { jobId } : {}),
      code,
      message,
      recoverable
    });
  }

  private postVectorError(
    jobId: string,
    revision: number,
    code: "invalid-options" | "trace-failed" | "output-limit" | "worker-failed",
    message: string,
    recoverable: boolean
  ): void {
    this.postMessage({
      type: "studio:vectorError",
      jobId,
      revision,
      code,
      message: message.slice(0, 500),
      recoverable
    });
  }

  private postPackageProgress(
    jobId: string,
    revision: number,
    stage: "staging" | "validating" | "installing" | "activating" | "reloading",
    message: string,
    progress: number
  ): void {
    this.postMessage({ type: "studio:packageProgress", jobId, revision, stage, message, progress });
  }

  private postPackageError(
    jobId: string,
    revision: number,
    code:
      | "metadata-invalid"
      | "validation-failed"
      | "install-failed"
      | "activation-failed"
      | "reload-failed"
      | "unknown",
    message: string,
    recoverable: boolean
  ): void {
    this.postMessage({
      type: "studio:packageError",
      jobId,
      revision,
      code,
      message: message.slice(0, 500),
      recoverable
    });
  }

  private postLibraryStatus(
    operation: "refresh" | "import" | "activate" | "validate" | "reload" | "reveal" | "export" | "remove",
    tone: "working" | "success" | "warning" | "error",
    message: string
  ): void {
    const boundedMessage = message.trim().slice(0, 500) || "Avatar library status is unavailable.";
    this.postMessage({ type: "library:status", operation, tone, message: boundedMessage });
  }

  private abortVectorization(jobId?: string): void {
    const active = this.activeVectorization;
    if (active && (!jobId || active.jobId === jobId)) active.controller.abort();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const cspSource = webview.cspSource;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview", "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview", "index.css"));
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; connect-src ${cspSource}; style-src ${cspSource}; script-src 'nonce-${nonce}' ${cspSource}; object-src 'none'; base-uri 'none'; form-action 'none';">
  <title>Codex Avatar Studio</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private createDefaultManifest(webview: vscode.Webview, assetRevision: number): AvatarManifest {
    const avatarUri = appendAssetRevision(
      webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "avatars", "svg", "placeholder-avatar.svg"))
        .toString(),
      assetRevision
    );
    const pixiManifestUri = appendAssetRevision(
      webview
        .asWebviewUri(
          vscode.Uri.joinPath(this.extensionUri, "media", "avatars", "pixi", "placeholder-spritesheet.json")
        )
        .toString(),
      assetRevision
    );

    return {
      schemaVersion: 1,
      version: "0.1.0",
      id: "default-coder-orb",
      name: "Default Coder Orb",
      author: "Codex Avatar Studio contributors",
      license: "UNLICENSED (original project work)",
      preferredRuntime: "svg",
      fallbackRuntime: "svg",
      entrypoints: {
        svg: avatarUri,
        pixi: pixiManifestUri
      },
      capabilities: ["state-animation", "one-shot-triggers", "speech-level", "reduced-motion"],
      states: {
        idle: "idle_loop",
        welcome: "greet_once",
        listening: "listen_loop",
        thinking: "think_loop",
        speaking: "talk_loop",
        coding: "type_loop",
        reviewing: "inspect_loop",
        debugging: "debug_loop",
        building: "scan_loop",
        success: "celebrate_once",
        warning: "concerned_loop",
        error: "error_once",
        sleeping: "sleep_loop"
      },
      triggers: {
        blink: "blink_once",
        nod: "nod_once",
        celebrate: "celebrate_once",
        shake: "shake_once",
        point: "point_once",
        "start-speaking": "talk_start",
        "stop-speaking": "talk_stop"
      },
      runtimePriority: ["svg", "pixi"],
      assets: {
        svg: avatarUri,
        pixi: pixiManifestUri
      }
    };
  }
}

function getNonce(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return nonce;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? undefined : (JSON.parse(serialized) as JsonValue);
  } catch {
    return String(value);
  }
}

function createWebviewManifest(
  avatarPackage: AvatarPackage,
  webview: vscode.Webview,
  assetRevision: number
): AvatarManifest {
  const toWebviewUri = (relativePath: string): string =>
    appendAssetRevision(
      webview.asWebviewUri(vscode.Uri.file(path.resolve(avatarPackage.rootPath, relativePath))).toString(),
      assetRevision
    );
  const mapPaths = (paths: Partial<Record<string, string>>): Partial<Record<string, string>> =>
    Object.fromEntries(Object.entries(paths).flatMap(([key, value]) => (value ? [[key, toWebviewUri(value)]] : [])));

  return {
    ...avatarPackage.manifest,
    entrypoints: mapPaths(avatarPackage.manifest.entrypoints),
    assets: avatarPackage.manifest.assets ? mapPaths(avatarPackage.manifest.assets) : undefined,
    previewImage: avatarPackage.manifest.previewImage ? toWebviewUri(avatarPackage.manifest.previewImage) : undefined
  };
}

function appendAssetRevision(uri: string, assetRevision: number): string {
  return appendUriQuery(uri, "codexAvatarAssetRevision", String(assetRevision));
}

function selectPackageRuntime(manifest: AvatarManifest): "svg" | "pixi" | "webgl" {
  if (
    manifest.preferredRuntime === "webgl" &&
    (manifest.entrypoints.webgl ?? manifest.assets?.webgl) &&
    (manifest.entrypoints.svg ?? manifest.assets?.svg)
  ) {
    return "webgl";
  }
  if (manifest.preferredRuntime === "pixi" && (manifest.entrypoints.pixi ?? manifest.assets?.pixi)) {
    return "pixi";
  }
  return "svg";
}

function appendUriQuery(uri: string, key: string, value: string): string {
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function vectorProgress(stage: VectorizeStage): { message: string; value: number } {
  switch (stage) {
    case "validating":
      return { message: "Checking source limits and format.", value: 0.08 };
    case "decoding":
      return { message: "Decoding the picture locally.", value: 0.2 };
    case "preprocessing":
      return { message: "Applying the selected cleanup settings.", value: 0.35 };
    case "tracing":
      return { message: "Tracing picture shapes into vector paths.", value: 0.55 };
    case "optimizing":
      return { message: "Sanitizing and optimizing the SVG.", value: 0.82 };
  }
}

function classifyVectorError(message: string): "invalid-options" | "trace-failed" | "output-limit" | "worker-failed" {
  if (/exceeds the .* (?:byte|path)|safety limit|complexity limit/i.test(message)) return "output-limit";
  if (/threshold|noise reduction|detail|quantization/i.test(message)) return "invalid-options";
  if (/worker|ENOENT|cannot find/i.test(message)) return "worker-failed";
  return "trace-failed";
}

function classifyPackageError(
  message: string
): "metadata-invalid" | "validation-failed" | "install-failed" | "activation-failed" | "reload-failed" | "unknown" {
  if (/id must|version must|must contain 1-160/i.test(message)) return "metadata-invalid";
  if (/validation|checksum|manifest|unsafe|invalid avatar package/i.test(message)) return "validation-failed";
  if (/reload|active avatar/i.test(message)) return "reload-failed";
  if (/install|rename|EACCES|EPERM|ENOSPC/i.test(message)) return "install-failed";
  return "unknown";
}

function boundedMessages(messages: string[], maxLength: number): string[] {
  return messages
    .slice(0, 64)
    .map((message) => message.trim().slice(0, maxLength))
    .filter(Boolean);
}

function redactKnownLocalPaths(message: string, roots: string[]): string {
  let redacted = message.replaceAll("\\", "/");
  for (const root of roots.map((value) => value.replaceAll("\\", "/")).sort((a, b) => b.length - a.length)) {
    redacted = redacted.replace(new RegExp(escapeRegExp(root), "gi"), "<local folder>");
  }
  return redacted.replace(/\bfile:\/\/\/[^\s"'<>]+/gi, "<local file>");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function libraryOperationFailureMessage(
  operation: "refresh" | "import" | "activate" | "validate" | "reload" | "reveal" | "export" | "remove"
): string {
  switch (operation) {
    case "refresh":
      return "The avatar library could not be refreshed. Check the workspace package files and try again.";
    case "import":
      return "The avatar package could not be imported. Choose a valid local package folder or manifest and try again.";
    case "activate":
      return "The avatar could not be activated. Validate the package, then try again.";
    case "validate":
      return "The avatar package could not be validated. Check that it still exists, then refresh the library.";
    case "reload":
      return "The active avatar could not be reloaded. The built-in SVG fallback remains available.";
    case "reveal":
      return "The avatar folder could not be opened. Refresh the library and try again.";
    case "export":
      return "The avatar package could not be exported. Validate it, choose a writable location outside the package, and try again.";
    case "remove":
      return "The avatar package could not be removed. Its previous files and selection were preserved where possible.";
  }
}

function unavailableBlenderStatus(message: string): BlenderStatusSnapshot {
  return {
    availability: "invalid",
    busy: false,
    executablePath: null,
    source: null,
    version: null,
    support: "unknown",
    capabilities: [],
    configuredPathInvalid: false,
    message
  };
}

function checkingBlenderStatus(current: BlenderStatusSnapshot, message: string): BlenderStatusSnapshot {
  return { ...current, availability: "checking", busy: true, message };
}

function failedBlenderStatus(
  current: BlenderStatusSnapshot,
  message: string,
  cancelled = false
): BlenderStatusSnapshot {
  return cancelled
    ? { ...current, busy: false, message }
    : { ...current, availability: "error", busy: false, support: "unknown", capabilities: [], message };
}

function blenderOperationProgressMessage(operation: "browse" | "detect" | "test"): string {
  switch (operation) {
    case "browse":
      return "Checking the selected Blender executable.";
    case "detect":
      return "Searching this computer for Blender.";
    case "test":
      return "Testing the Blender connection.";
  }
}

function blenderStatusTone(status: BlenderStatusSnapshot): "success" | "warning" | "error" {
  if (status.availability === "ready" && status.support === "supported") return "success";
  if (status.availability === "error") return "error";
  return "warning";
}

function boundedErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 500) || "The Blender operation failed.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function throwIfCancelled(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error("Image vectorization was cancelled.");
  error.name = "AbortError";
  throw error;
}

function throwIfPackageSaveCancelled(cancelled: boolean): void {
  if (!cancelled) return;
  const error = new Error("Avatar package save was cancelled before activation completed.");
  error.name = "AbortError";
  throw error;
}
