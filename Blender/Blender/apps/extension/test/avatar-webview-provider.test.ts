import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { VectorizePreview } from "@codex-avatar-studio/asset-pipeline";
import type { AvatarManifest, VectorizeStudioOptions } from "@codex-avatar-studio/avatar-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarPackageRegistry } from "../src/avatarPackages.js";
import type { VectorizationRunner } from "../src/vectorizationWorkerRunner.js";

const vscodeMock = vi.hoisted(() => ({
  state: {
    trusted: true,
    workspaceFolders: [{ uri: { fsPath: "C:/workspace" } }] as Array<{ uri: { fsPath: string } }> | undefined,
    selectedFiles: undefined as Array<{ fsPath: string }> | undefined,
    selectedSaveFile: undefined as { fsPath: string } | undefined,
    config: new Map<string, unknown>()
  },
  api: {
    ConfigurationTarget: { Global: 1 },
    Uri: {
      file: (fsPath: string) => ({ fsPath, toString: () => fsPath }),
      joinPath: (base: { fsPath: string }, ...segments: string[]) => {
        const fsPath = path.join(base.fsPath, ...segments);
        return { fsPath, toString: () => fsPath };
      }
    },
    commands: { executeCommand: vi.fn() },
    env: { clipboard: { writeText: vi.fn(async () => undefined) } },
    window: {
      showOpenDialog: vi.fn(async () => vscodeMock.state.selectedFiles),
      showSaveDialog: vi.fn(async () => vscodeMock.state.selectedSaveFile),
      showWarningMessage: vi.fn()
    },
    workspace: {
      get isTrusted() {
        return vscodeMock.state.trusted;
      },
      get workspaceFolders() {
        return vscodeMock.state.workspaceFolders;
      },
      getConfiguration: () => ({
        get: (key: string, fallback: unknown) =>
          vscodeMock.state.config.has(key) ? vscodeMock.state.config.get(key) : fallback,
        update: async (key: string, value: unknown) => {
          if (value === undefined) vscodeMock.state.config.delete(key);
          else vscodeMock.state.config.set(key, value);
        }
      })
    }
  }
}));

vi.mock("vscode", () => vscodeMock.api);

import {
  AvatarWebviewProvider,
  type BlenderIntegration,
  type BlenderStatusSnapshot
} from "../src/AvatarWebviewProvider.js";

beforeEach(() => {
  vscodeMock.state.trusted = true;
  vscodeMock.state.workspaceFolders = [{ uri: { fsPath: path.resolve("C:/workspace") } }];
  vscodeMock.state.selectedFiles = undefined;
  vscodeMock.state.selectedSaveFile = undefined;
  vscodeMock.state.config.clear();
  vi.clearAllMocks();
});

describe("AvatarWebviewProvider asset manifests", () => {
  it("maps an active package SVG to a cache-versioned Webview URI and refreshes it on reload", async () => {
    const avatarRoot = path.resolve("C:/workspace/.codex-avatar/avatars/custom-avatar");
    const registry = createRegistry({
      id: "custom-avatar",
      rootPath: avatarRoot,
      manifest: createManifest("custom-avatar", "svg/avatar.svg")
    });
    const provider = new AvatarWebviewProvider(
      { fsPath: path.resolve("C:/extension") } as never,
      registry as unknown as AvatarPackageRegistry
    );
    const smoke = createWebviewSmoke();
    provider.resolveWebviewView(smoke.view as never);

    await provider.reloadAssets();
    await provider.reloadAssets();

    const manifests = smoke.messages.filter(
      (message): message is ManifestMessage => isRecord(message) && message.type === "assets:manifestLoaded"
    );
    expect(manifests).toHaveLength(2);
    expect(manifests[0]?.manifest.id).toBe("custom-avatar");
    expect(manifests[0]?.manifest.entrypoints.svg).toContain("svg/avatar.svg");
    expect(manifests[0]?.manifest.entrypoints.svg).toContain("codexAvatarAssetRevision=1");
    expect(manifests[1]?.manifest.entrypoints.svg).toContain("codexAvatarAssetRevision=2");
    expect(manifests[1]?.manifest.entrypoints.svg).not.toBe(manifests[0]?.manifest.entrypoints.svg);
  });

  it("posts the built-in SVG manifest when the active package cannot load", async () => {
    const provider = new AvatarWebviewProvider(
      { fsPath: path.resolve("C:/extension") } as never,
      createRegistry(undefined, new Error("broken package")) as unknown as AvatarPackageRegistry
    );
    const smoke = createWebviewSmoke();
    provider.resolveWebviewView(smoke.view as never);

    await provider.reloadAssets();

    const fallback = smoke.messages.find(
      (message): message is ManifestMessage => isRecord(message) && message.type === "assets:manifestLoaded"
    );
    expect(fallback?.manifest.id).toBe("default-coder-orb");
    expect(fallback?.manifest.entrypoints.svg).toContain("placeholder-avatar.svg");
  });

  it("does not read or expose workspace packages while the workspace is untrusted", async () => {
    const avatarRoot = path.resolve("C:/workspace/.codex-avatar/avatars/private-avatar");
    const registry = createRegistry({
      id: "private-avatar",
      rootPath: avatarRoot,
      manifest: createManifest("private-avatar", "svg/avatar.svg")
    });
    const provider = new AvatarWebviewProvider(
      { fsPath: path.resolve("C:/extension") } as never,
      registry as unknown as AvatarPackageRegistry
    );
    const smoke = createWebviewSmoke();
    provider.resolveWebviewView(smoke.view as never);
    vscodeMock.state.trusted = false;

    await provider.reloadAssets();
    await provider.postAvatarLibrary();

    expect(registry.getActivePackage).not.toHaveBeenCalled();
    const manifestMessage = smoke.messages.find(
      (message): message is ManifestMessage => isRecord(message) && message.type === "assets:manifestLoaded"
    );
    expect(manifestMessage?.manifest.id).toBe("default-coder-orb");
    const libraryUpdate = smoke.messages.find(
      (message): message is LibraryUpdateMessage => isRecord(message) && message.type === "library:updated"
    );
    expect(libraryUpdate).toMatchObject({ workspaceAvailable: true, workspaceTrusted: false, activeId: null });
    expect(libraryUpdate?.avatars).toEqual([
      expect.objectContaining({ id: "default-coder-orb", active: true, builtIn: true })
    ]);
    expect(JSON.stringify(smoke.messages)).not.toContain("private-avatar");
  });

  it("returns structured workspace and picker states to the Webview", async () => {
    const provider = new AvatarWebviewProvider(
      { fsPath: path.resolve("C:/extension") } as never,
      createRegistry(undefined) as unknown as AvatarPackageRegistry
    );
    const smoke = createWebviewSmoke();
    provider.resolveWebviewView(smoke.view as never);

    vscodeMock.state.workspaceFolders = undefined;
    await provider.choosePicture();
    expect(smoke.messages).toContainEqual(
      expect.objectContaining({ type: "studio:imageError", code: "workspace-required", recoverable: true })
    );

    vscodeMock.state.workspaceFolders = [{ uri: { fsPath: path.resolve("C:/workspace") } }];
    smoke.messages.length = 0;
    await provider.choosePicture();
    expect(smoke.messages).toContainEqual(
      expect.objectContaining({ type: "studio:imageProgress", stage: "selecting" })
    );
    expect(smoke.messages).toContainEqual(expect.objectContaining({ type: "studio:imageCancelled", reason: "picker" }));
  });

  it("routes typed Blender setup operations and blocks probing in an untrusted workspace", async () => {
    const initialStatus: BlenderStatusSnapshot = {
      availability: "missing",
      busy: false,
      executablePath: null,
      source: null,
      version: null,
      support: "unknown",
      capabilities: [],
      configuredPathInvalid: false,
      message: "Blender has not been checked."
    };
    const readyStatus: BlenderStatusSnapshot = {
      availability: "ready",
      busy: false,
      executablePath: "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe",
      source: "platform",
      version: { major: 4, minor: 5, patch: 3, label: "Blender 4.5.3 LTS" },
      support: "supported",
      capabilities: ["svg", "glb", "png"],
      configuredPathInvalid: false,
      message: "Blender 4.5.3 is connected and ready."
    };
    const integration: BlenderIntegration = {
      getStatus: vi.fn(() => initialStatus),
      refresh: vi.fn(async () => readyStatus),
      browse: vi.fn(async () => readyStatus),
      autoDetect: vi.fn(async () => readyStatus),
      test: vi.fn(async () => readyStatus),
      cancel: vi.fn(async () => readyStatus),
      openLog: vi.fn(),
      openOutput: vi.fn(async () => undefined),
      createSceneFromSvg: vi.fn(async () => ({
        scenePath: "C:/workspace/.codex-avatar/exports/blender/avatar.working.blend",
        reportPath: "C:/workspace/.codex-avatar/exports/blender/avatar.scene.export-report.json"
      }))
    };
    const provider = new AvatarWebviewProvider(
      { fsPath: path.resolve("C:/extension") } as never,
      createRegistry(undefined) as unknown as AvatarPackageRegistry,
      undefined,
      integration
    );
    const smoke = createWebviewSmoke();
    provider.resolveWebviewView(smoke.view as never);

    provider.postBlenderStatus();
    expect(smoke.messages).toContainEqual(expect.objectContaining({ type: "blender:status", availability: "missing" }));

    await smoke.send({ protocolVersion: 1, type: "blender:refresh" });
    await vi.waitFor(() => expect(integration.refresh).toHaveBeenCalledTimes(1));
    expect(smoke.messages).toContainEqual(
      expect.objectContaining({ type: "blender:status", availability: "ready", capabilities: ["svg", "glb", "png"] })
    );

    for (const [requestType, method, operation] of [
      ["blender:browse", integration.browse, "browse"],
      ["blender:autoDetect", integration.autoDetect, "detect"],
      ["blender:test", integration.test, "test"]
    ] as const) {
      await smoke.send({ protocolVersion: 1, type: requestType });
      await vi.waitFor(() => expect(method).toHaveBeenCalledTimes(1));
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({ type: "blender:operation", operation, tone: "success" })
      );
    }

    await smoke.send({ protocolVersion: 1, type: "blender:openLog" });
    await smoke.send({ protocolVersion: 1, type: "blender:openOutput" });
    await smoke.send({ protocolVersion: 1, type: "blender:cancel" });
    await vi.waitFor(() => {
      expect(integration.openLog).toHaveBeenCalledTimes(1);
      expect(integration.openOutput).toHaveBeenCalledTimes(1);
      expect(integration.cancel).toHaveBeenCalledTimes(1);
    });

    vscodeMock.state.trusted = false;
    await smoke.send({ protocolVersion: 1, type: "blender:autoDetect" });
    await vi.waitFor(() =>
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({
          type: "blender:status",
          availability: "invalid",
          message: expect.stringMatching(/Trust this workspace/)
        })
      )
    );
    expect(integration.autoDetect).toHaveBeenCalledTimes(1);
  });

  it("posts bounded Blender export results without exposing local export paths", () => {
    const provider = new AvatarWebviewProvider({ fsPath: path.resolve("C:/extension") } as never);
    const smoke = createWebviewSmoke();
    provider.resolveWebviewView(smoke.view as never);

    provider.recordBlenderExport("C:/outside/Mascot.blend", [
      {
        status: "success",
        mode: "svg",
        outputPath: "C:/workspace/.codex-avatar/exports/blender/Mascot.line-art.svg",
        manifestPath: "C:/workspace/.codex-avatar/exports/blender/Mascot.svg.export-report.json"
      },
      { status: "failed", mode: "glb", message: "No exportable mesh was found." }
    ]);

    expect(smoke.messages).toContainEqual(
      expect.objectContaining({
        type: "blender:exportResult",
        sourceFile: "Mascot.blend",
        canUseAsAvatar: true,
        results: [
          expect.objectContaining({ status: "success", mode: "svg", fileName: "Mascot.line-art.svg" }),
          expect.objectContaining({ status: "failed", mode: "glb" })
        ]
      })
    );
    expect(JSON.stringify(smoke.messages)).not.toContain("C:/workspace/.codex-avatar/exports");
  });

  it("selects, copies, previews, and disposes a real local picture job", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-provider-picture-"));
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const source = path.join(root, "avatar.png");
    const traceablePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
      "base64"
    );
    await mkdir(workspace, { recursive: true });
    await writeFile(source, traceablePng);
    vscodeMock.state.workspaceFolders = [{ uri: { fsPath: workspace } }];
    vscodeMock.state.selectedFiles = [{ fsPath: source }];

    try {
      const vectorizationRunner: VectorizationRunner = vi.fn(async (_workerPath, request, _signal, onProgress) => {
        onProgress("tracing");
        return createVectorPreview(request.inputPath, request.workspaceRoot);
      });
      const handoffStatus: BlenderStatusSnapshot = {
        availability: "ready",
        busy: false,
        executablePath: "C:/Blender/blender.exe",
        source: "setting",
        version: { major: 4, minor: 5, patch: 3, label: "Blender 4.5.3 LTS" },
        support: "supported",
        capabilities: ["svg", "glb", "png"],
        configuredPathInvalid: false,
        message: "Blender is ready."
      };
      const blenderIntegration: BlenderIntegration = {
        getStatus: vi.fn(() => handoffStatus),
        refresh: vi.fn(async () => handoffStatus),
        browse: vi.fn(async () => handoffStatus),
        autoDetect: vi.fn(async () => handoffStatus),
        test: vi.fn(async () => handoffStatus),
        cancel: vi.fn(async () => handoffStatus),
        openLog: vi.fn(),
        openOutput: vi.fn(async () => undefined),
        createSceneFromSvg: vi.fn(async () => ({
          scenePath: path.join(assetRoot, "exports", "blender", "avatar.working.blend"),
          reportPath: path.join(assetRoot, "exports", "blender", "avatar.scene.export-report.json")
        }))
      };
      const provider = new AvatarWebviewProvider(
        { fsPath: path.resolve("C:/extension") } as never,
        createRegistry(undefined, undefined, assetRoot) as unknown as AvatarPackageRegistry,
        vectorizationRunner,
        blenderIntegration
      );
      const smoke = createWebviewSmoke();
      provider.resolveWebviewView(smoke.view as never);

      await provider.choosePicture();

      const selected = smoke.messages.find(
        (message): message is PictureSelectedMessage => isRecord(message) && message.type === "studio:imageSelected"
      );
      expect(selected?.selection.fileName).toBe("avatar.png");
      expect(selected?.selection.width).toBe(16);
      expect(selected?.selection.height).toBe(16);
      expect(selected?.selection.previewUri).toContain("codexAvatarPictureJob=");
      expect(selected?.selection.sourceKind).toBe("external");
      expect(await readFile(source)).toEqual(traceablePng);
      expect(smoke.webview.options.localResourceRoots).toEqual(
        expect.arrayContaining([expect.objectContaining({ fsPath: assetRoot })])
      );

      await provider.vectorizePicture(selected?.selection.jobId ?? "", 1, colorIllustrationOptions);
      const vectorPreview = smoke.messages.find(
        (message): message is VectorPreviewMessage => isRecord(message) && message.type === "studio:vectorPreview"
      );
      expect(vectorPreview?.previewUri).toContain("codexAvatarVectorRevision=1");
      expect(vectorPreview?.metrics.pathCount).toBe(3);
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({ type: "studio:vectorProgress", stage: "tracing" })
      );
      expect(
        await readFile(
          path.join(assetRoot, "cache", "jobs", selected?.selection.jobId ?? "", "vector", "optimized-1.svg"),
          "utf8"
        )
      ).toContain("<svg");

      await provider.createBlenderSceneFromCurrentSvg(selected?.selection.jobId ?? "", 1);
      expect(blenderIntegration.createSceneFromSvg).toHaveBeenCalledWith(
        expect.objectContaining({
          svgPath: expect.stringMatching(/optimized-1\.svg$/),
          sourceName: "avatar.png"
        })
      );
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({
          type: "blender:handoffStatus",
          tone: "success",
          sceneFileName: "avatar.working.blend"
        })
      );
      expect(
        smoke.messages.some(
          (message) =>
            isRecord(message) && message.type === "blender:handoffStatus" && JSON.stringify(message).includes(assetRoot)
        )
      ).toBe(false);

      smoke.dispose();
      await vi.waitFor(async () => {
        expect(await readdir(path.join(assetRoot, "cache", "jobs"))).toHaveLength(0);
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("aborts an in-flight worker conversion and never publishes a late SVG preview", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-provider-cancel-"));
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const source = path.join(root, "avatar.png");
    await mkdir(workspace, { recursive: true });
    await writeFile(
      source,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
        "base64"
      )
    );
    vscodeMock.state.workspaceFolders = [{ uri: { fsPath: workspace } }];
    vscodeMock.state.selectedFiles = [{ fsPath: source }];

    try {
      const runner: VectorizationRunner = vi.fn((_workerPath, _request, signal, onProgress) => {
        onProgress("tracing");
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("cancelled");
            error.name = "AbortError";
            reject(error);
          });
        });
      });
      const provider = new AvatarWebviewProvider(
        { fsPath: path.resolve("C:/extension") } as never,
        createRegistry(undefined, undefined, assetRoot) as unknown as AvatarPackageRegistry,
        runner
      );
      const smoke = createWebviewSmoke();
      provider.resolveWebviewView(smoke.view as never);
      await provider.choosePicture();
      const selected = smoke.messages.find(
        (message): message is PictureSelectedMessage => isRecord(message) && message.type === "studio:imageSelected"
      );
      const jobId = selected?.selection.jobId ?? "";

      const running = provider.vectorizePicture(jobId, 7, colorIllustrationOptions);
      await vi.waitFor(() => {
        expect(smoke.messages).toContainEqual(
          expect.objectContaining({ type: "studio:vectorProgress", stage: "tracing" })
        );
      });
      await provider.cancelVectorization(jobId, 7);
      await running;

      expect(smoke.messages).toContainEqual(
        expect.objectContaining({ type: "studio:vectorCancelled", jobId, revision: 7 })
      );
      expect(smoke.messages.some((message) => isRecord(message) && message.type === "studio:vectorPreview")).toBe(
        false
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("saves, validates, registers, activates, reloads, and persists a generated SVG package", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-provider-save-"));
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const source = path.join(root, "portrait.png");
    const sourceBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
      "base64"
    );
    await mkdir(workspace, { recursive: true });
    await writeFile(source, sourceBytes);
    vscodeMock.state.workspaceFolders = [{ uri: { fsPath: workspace } }];
    vscodeMock.state.selectedFiles = [{ fsPath: source }];

    try {
      const registry = new AvatarPackageRegistry(
        () => workspace,
        () => ".codex-avatar"
      );
      const runner: VectorizationRunner = vi.fn(async (_workerPath, request, _signal, onProgress) => {
        onProgress("tracing");
        return createVectorPreview(request.inputPath, request.workspaceRoot);
      });
      const provider = new AvatarWebviewProvider({ fsPath: path.resolve("C:/extension") } as never, registry, runner);
      const smoke = createWebviewSmoke();
      provider.resolveWebviewView(smoke.view as never);
      await provider.choosePicture();
      const selected = smoke.messages.find(
        (message): message is PictureSelectedMessage => isRecord(message) && message.type === "studio:imageSelected"
      );
      const jobId = selected?.selection.jobId ?? "";
      await provider.vectorizePicture(jobId, 1, colorIllustrationOptions);
      await provider.saveGeneratedAvatar(
        jobId,
        1,
        {
          id: "saved-purple-avatar",
          name: "Saved Purple Avatar",
          author: "Test Artist",
          version: "1.0.0",
          license: "Original artwork — all rights reserved"
        },
        "reject"
      );

      const packageRoot = path.join(assetRoot, "avatars", "saved-purple-avatar");
      const manifest = JSON.parse(await readFile(path.join(packageRoot, "avatar.manifest.json"), "utf8"));
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        id: "saved-purple-avatar",
        preferredRuntime: "svg",
        entrypoints: { svg: "svg/avatar.svg" }
      });
      expect(await readFile(source)).toEqual(sourceBytes);
      expect((await registry.getActivePackage())?.id).toBe("saved-purple-avatar");
      const reloadedRegistry = new AvatarPackageRegistry(
        () => workspace,
        () => ".codex-avatar"
      );
      expect((await reloadedRegistry.getActivePackage())?.id).toBe("saved-purple-avatar");
      expect(vscodeMock.state.config.get("runtime")).toBe("svg");
      expect(vscodeMock.state.config.get("character")).toBe("saved-purple-avatar");
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({
          type: "studio:packageSaved",
          avatar: expect.objectContaining({ id: "saved-purple-avatar" })
        })
      );
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({
          type: "assets:manifestLoaded",
          manifest: expect.objectContaining({ id: "saved-purple-avatar" })
        })
      );
      expect(await readdir(path.join(assetRoot, "cache", "jobs"))).toHaveLength(0);

      const libraryUpdate = smoke.messages.find(
        (message): message is LibraryUpdateMessage => isRecord(message) && message.type === "library:updated"
      );
      expect(libraryUpdate).toMatchObject({
        activeId: "saved-purple-avatar",
        workspaceAvailable: true,
        workspaceTrusted: true
      });
      expect(libraryUpdate?.avatars).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "default-coder-orb", builtIn: true, active: false }),
          expect.objectContaining({ id: "saved-purple-avatar", active: true, valid: true })
        ])
      );
      const serializedLibrary = JSON.stringify(libraryUpdate);
      expect(serializedLibrary).not.toContain(packageRoot.replaceAll("\\", "/"));
      expect(serializedLibrary).not.toMatch(/(?:file|vscode-webview):/i);

      await smoke.send({ protocolVersion: 1, type: "library:refresh" });
      await vi.waitFor(() => {
        expect(smoke.messages).toContainEqual(
          expect.objectContaining({ type: "library:status", operation: "refresh", tone: "success" })
        );
      });

      await smoke.send({ protocolVersion: 1, type: "library:validate", id: "saved-purple-avatar" });
      await vi.waitFor(() => {
        expect(smoke.messages).toContainEqual(
          expect.objectContaining({
            type: "library:validationResult",
            id: "saved-purple-avatar",
            valid: true,
            errors: []
          })
        );
      });

      const archivePath = path.join(root, "saved-purple-avatar.codex-avatar.zip");
      vscodeMock.state.selectedSaveFile = { fsPath: archivePath };
      vscodeMock.api.window.showWarningMessage.mockResolvedValueOnce("Export Local Backup");
      await smoke.send({ protocolVersion: 1, type: "library:export", id: "saved-purple-avatar" });
      await vi.waitFor(async () => {
        expect((await readFile(archivePath)).readUInt32LE(0)).toBe(0x04034b50);
        expect(smoke.messages).toContainEqual(
          expect.objectContaining({ type: "library:status", operation: "export", tone: "success" })
        );
      });
      expect(vscodeMock.api.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("may not permit redistribution"),
        expect.objectContaining({ modal: true, detail: expect.stringContaining("all rights reserved") }),
        "Export Local Backup"
      );

      await smoke.send({ protocolVersion: 1, type: "library:activate", id: null });
      await vi.waitFor(async () => {
        expect(await registry.getActivePackage()).toBeUndefined();
        expect(vscodeMock.state.config.get("character")).toBe("default");
      });
      await smoke.send({ protocolVersion: 1, type: "library:activate", id: "saved-purple-avatar" });
      await vi.waitFor(async () => {
        expect((await registry.getActivePackage())?.id).toBe("saved-purple-avatar");
        expect(vscodeMock.state.config.get("character")).toBe("saved-purple-avatar");
      });

      await smoke.send({ protocolVersion: 1, type: "studio:revealAvatar", id: "saved-purple-avatar" });
      await smoke.send({ protocolVersion: 1, type: "studio:copyAvatarPath", id: "saved-purple-avatar" });
      await vi.waitFor(() => {
        expect(vscodeMock.api.commands.executeCommand).toHaveBeenCalledWith("revealFileInOS", expect.anything());
        expect(vscodeMock.api.env.clipboard.writeText).toHaveBeenCalledWith(packageRoot);
      });

      await provider.choosePicture();
      const replacementSelection = smoke.messages
        .filter(
          (message): message is PictureSelectedMessage => isRecord(message) && message.type === "studio:imageSelected"
        )
        .at(-1);
      const replacementJobId = replacementSelection?.selection.jobId ?? "";
      await provider.vectorizePicture(replacementJobId, 2, colorIllustrationOptions);
      const duplicateMetadata = {
        id: "saved-purple-avatar",
        name: "Saved Purple Avatar Copy",
        author: "Test Artist",
        version: "1.0.0",
        license: "Original artwork — all rights reserved"
      };
      await provider.saveGeneratedAvatar(replacementJobId, 2, duplicateMetadata, "reject");
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({
          type: "studio:packageCollision",
          id: "saved-purple-avatar",
          suggestedCopyId: "saved-purple-avatar-2"
        })
      );
      await provider.saveGeneratedAvatar(replacementJobId, 2, duplicateMetadata, "copy");
      expect((await registry.getActivePackage())?.id).toBe("saved-purple-avatar-2");
      expect((await registry.listPackages()).map((avatarPackage) => avatarPackage.id).sort()).toEqual([
        "saved-purple-avatar",
        "saved-purple-avatar-2"
      ]);

      await smoke.send({ protocolVersion: 1, type: "library:remove", id: "saved-purple-avatar" });
      await vi.waitFor(async () => {
        expect((await registry.listPackages()).map((avatarPackage) => avatarPackage.id)).toEqual([
          "saved-purple-avatar-2"
        ]);
      });
      await expect(access(packageRoot)).rejects.toMatchObject({ code: "ENOENT" });

      const copyRoot = path.join(assetRoot, "avatars", "saved-purple-avatar-2");
      await rm(path.join(copyRoot, "svg", "avatar.svg"));
      await smoke.send({ protocolVersion: 1, type: "library:validate", id: "saved-purple-avatar-2" });
      await vi.waitFor(() => {
        const validationResult = smoke.messages
          .filter(
            (message): message is LibraryValidationMessage =>
              isRecord(message) && message.type === "library:validationResult"
          )
          .at(-1);
        expect(validationResult).toMatchObject({ id: "saved-purple-avatar-2", valid: false });
        expect(validationResult?.errors.length).toBeGreaterThan(0);
        expect(JSON.stringify(validationResult)).not.toContain(assetRoot.replaceAll("\\", "/"));
        expect(JSON.stringify(validationResult)).not.toMatch(/[A-Za-z]:[\\/]/);
      });

      await smoke.send({ protocolVersion: 1, type: "library:remove", id: "saved-purple-avatar-2" });
      await vi.waitFor(async () => {
        expect(await registry.listPackages()).toHaveLength(0);
        expect(await registry.getActivePackage()).toBeUndefined();
        expect(vscodeMock.state.config.get("character")).toBe("default");
      });
      const latestLibraryUpdate = smoke.messages
        .filter((message): message is LibraryUpdateMessage => isRecord(message) && message.type === "library:updated")
        .at(-1);
      expect(latestLibraryUpdate?.avatars).toEqual([
        expect.objectContaining({ id: "default-coder-orb", active: true, builtIn: true })
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls package files, registry, and settings back when the new avatar cannot reload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-provider-rollback-"));
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const source = path.join(root, "portrait.png");
    await mkdir(workspace, { recursive: true });
    await writeFile(
      source,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
        "base64"
      )
    );
    vscodeMock.state.workspaceFolders = [{ uri: { fsPath: workspace } }];
    vscodeMock.state.selectedFiles = [{ fsPath: source }];

    try {
      const registry = new AvatarPackageRegistry(
        () => workspace,
        () => ".codex-avatar"
      );
      const runner: VectorizationRunner = vi.fn(async (_workerPath, request) =>
        createVectorPreview(request.inputPath, request.workspaceRoot)
      );
      const provider = new AvatarWebviewProvider({ fsPath: path.resolve("C:/extension") } as never, registry, runner);
      const smoke = createWebviewSmoke();
      provider.resolveWebviewView(smoke.view as never);
      await provider.choosePicture();
      const selected = smoke.messages.find(
        (message): message is PictureSelectedMessage => isRecord(message) && message.type === "studio:imageSelected"
      );
      const jobId = selected?.selection.jobId ?? "";
      await provider.vectorizePicture(jobId, 1, colorIllustrationOptions);
      vi.spyOn(registry, "getActivePackage").mockRejectedValueOnce(new Error("simulated reload failure"));

      await provider.saveGeneratedAvatar(
        jobId,
        1,
        {
          id: "rollback-avatar",
          name: "Rollback Avatar",
          author: "Test Artist",
          version: "1.0.0",
          license: "UNLICENSED"
        },
        "reject"
      );

      expect(await registry.listPackages()).toHaveLength(0);
      await expect(access(path.join(assetRoot, "avatars", "rollback-avatar"))).rejects.toMatchObject({
        code: "ENOENT"
      });
      expect(vscodeMock.state.config.get("character")).toBe("default");
      expect(vscodeMock.state.config.get("runtime")).toBe("svg");
      expect(smoke.messages).toContainEqual(
        expect.objectContaining({ type: "studio:packageError", code: "reload-failed" })
      );
      expect(smoke.messages.some((message) => isRecord(message) && message.type === "studio:packageSaved")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function createManifest(id: string, svgPath: string): AvatarManifest {
  return {
    schemaVersion: 1,
    id,
    name: "Custom Avatar",
    version: "1.0.0",
    author: "Test Author",
    license: "UNLICENSED",
    preferredRuntime: "svg",
    fallbackRuntime: "svg",
    entrypoints: { svg: svgPath },
    capabilities: ["state-animation", "reduced-motion"],
    states: { idle: "idle_loop" }
  };
}

function createRegistry(
  activePackage?: unknown,
  error?: Error,
  assetRoot = path.resolve("C:/workspace/.codex-avatar")
) {
  return {
    getAssetRoot: () => assetRoot,
    getActivePackage: vi.fn(async () => {
      if (error) throw error;
      return activePackage;
    })
  };
}

function createWebviewSmoke() {
  const messages: unknown[] = [];
  let disposeHandler: (() => void) | undefined;
  let messageHandler: ((message: unknown) => void) | undefined;
  const webview = {
    cspSource: "vscode-webview://codex-avatar-studio",
    html: "",
    options: {},
    asWebviewUri(uri: { fsPath: string }) {
      const normalizedPath = uri.fsPath.replaceAll("\\", "/").replace(/^[A-Za-z]:/, "");
      return {
        fsPath: uri.fsPath,
        toString: () =>
          `vscode-webview://codex-avatar-studio${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`
      };
    },
    onDidReceiveMessage: (handler: (message: unknown) => void) => {
      messageHandler = handler;
      return { dispose() {} };
    },
    postMessage(message: unknown) {
      messages.push(message);
      return Promise.resolve(true);
    }
  };

  const view = {
    webview,
    onDidDispose: (handler: () => void) => {
      disposeHandler = handler;
      return { dispose() {} };
    }
  };

  return {
    dispose: () => disposeHandler?.(),
    messages,
    send: async (message: unknown) => {
      messageHandler?.(message);
      await vi.waitFor(() => expect(messageHandler).toBeDefined());
    },
    view,
    webview
  };
}

type ManifestMessage = {
  type: "assets:manifestLoaded";
  manifest: AvatarManifest;
};

type PictureSelectedMessage = {
  type: "studio:imageSelected";
  selection: {
    fileName: string;
    height: number;
    jobId: string;
    previewUri: string;
    sourceKind: string;
    width: number;
  };
};

type VectorPreviewMessage = {
  type: "studio:vectorPreview";
  previewUri: string;
  metrics: { pathCount: number };
};

type LibraryUpdateMessage = {
  type: "library:updated";
  activeId: string | null;
  workspaceAvailable: boolean;
  workspaceTrusted: boolean;
  avatars: Array<{ id: string; active: boolean; builtIn: boolean; valid: boolean }>;
};

type LibraryValidationMessage = {
  type: "library:validationResult";
  id: string;
  valid: boolean;
  errors: string[];
};

const colorIllustrationOptions: VectorizeStudioOptions = {
  preset: "color-illustration",
  grayscale: false,
  colorCount: 16,
  threshold: null,
  removeNearWhite: true,
  noiseReduction: 10,
  detail: "balanced"
};

function createVectorPreview(inputPath: string, workspaceRoot: string): VectorizePreview {
  const validation = {
    valid: false,
    profile: "reference" as const,
    warnings: ["Missing optional layers."],
    requiredLayers: ["avatar/root"],
    missingLayers: ["avatar/root"],
    unnamedGroups: 0,
    tinyPathCount: 1,
    pathCount: 3,
    groupCount: 0,
    byteLength: 96
  };
  return {
    inputPath,
    exportDirectory: path.join(workspaceRoot, ".codex-avatar", "exports", "svg"),
    rawSvgPath: path.join(workspaceRoot, ".codex-avatar", "exports", "svg", "avatar.raw-trace.svg"),
    optimizedSvgPath: path.join(workspaceRoot, ".codex-avatar", "exports", "svg", "avatar.optimized.svg"),
    manifestPath: path.join(workspaceRoot, ".codex-avatar", "exports", "svg", "avatar.manifest.json"),
    rawSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>',
    optimizedSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>',
    rawValidation: validation,
    optimizedValidation: validation,
    warnings: validation.warnings
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
