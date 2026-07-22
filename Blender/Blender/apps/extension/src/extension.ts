import * as vscode from "vscode";
import { AvatarWebviewProvider } from "./AvatarWebviewProvider.js";
import { AvatarPackageError, AvatarPackageRegistry } from "./avatarPackages.js";
import { avatarStates, isAvatarState, isIdeAssistantEvent, type AvatarState } from "./avatarState.js";
import { BlenderIntegrationController } from "./blenderIntegration.js";
import type { BlenderExportMode } from "./blenderRunner.js";
import { IdeEventsController } from "./ideEvents.js";
import { getAvatarConfig, resetAvatarConfig, toggleAssistantEnabled, updateAvatarConfig } from "./settings.js";

let activeIdeEvents: IdeEventsController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const initialConfig = getAvatarConfig();
  const packageRegistry = new AvatarPackageRegistry(
    () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    () => getAvatarConfig().assetWorkspace
  );
  const blenderOutputChannel = vscode.window.createOutputChannel("Codex Avatar Blender");
  const blenderIntegration = new BlenderIntegrationController({
    extensionRoot: context.extensionUri.fsPath,
    outputChannel: blenderOutputChannel,
    workspaceRootProvider: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    assetRootProvider: () => packageRegistry.getAssetRoot()
  });
  const provider = new AvatarWebviewProvider(context.extensionUri, packageRegistry, undefined, blenderIntegration);
  const ideEvents = new IdeEventsController(provider, {
    defaultIdleDelayMs: initialConfig.idleTimeout * 1000,
    sleepDelayMs: initialConfig.sleepTimeout * 1000
  });
  ideEvents.start();
  activeIdeEvents = ideEvents;

  const deleteImportedAvatar = async (): Promise<void> => {
    if (!requireWorkspaceTrust("delete an imported avatar")) return;
    try {
      const packages = await packageRegistry.listPackages();
      const selected = await vscode.window.showQuickPick(
        packages.map((avatarPackage) => ({ label: avatarPackage.manifest.name, description: avatarPackage.id })),
        { title: "Codex Avatar: Delete Imported Avatar Package" }
      );
      if (!selected) return;
      const wasActive = await packageRegistry.removeAvatar(selected.description);
      if (wasActive) await updateAvatarConfig({ character: "default" });
      if (wasActive) void provider.reloadAssets();
      vscode.window.showInformationMessage(
        wasActive ? "Avatar deleted. The built-in avatar is active again." : "Avatar package deleted."
      );
    } catch (error) {
      showPackageError(error);
    }
  };

  context.subscriptions.push(
    ideEvents,
    blenderOutputChannel,
    blenderIntegration,
    provider,
    vscode.window.registerWebviewViewProvider(AvatarWebviewProvider.viewType, provider),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("codexAvatar")) {
        provider.refreshSettings();
        const config = getAvatarConfig();
        ideEvents.updateTiming(config.idleTimeout, config.sleepTimeout);
      }
    }),
    registerCommand("codexAvatar.openAssistant", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.codexAvatar");
    }),
    registerCommand("codexAvatar.toggleAssistant", async () => {
      const enabled = await toggleAssistantEnabled();
      const nextState: AvatarState = enabled ? "welcome" : "sleeping";
      provider.setState(nextState);
      vscode.window.showInformationMessage(`Codex Avatar ${enabled ? "enabled" : "disabled"}.`);
    }),
    registerCommand("codexAvatar.resetSettings", async () => {
      await resetAvatarConfig();
      provider.refreshSettings();
      provider.setState("welcome");
      provider.trigger("nod");
      vscode.window.showInformationMessage("Codex Avatar settings reset.");
    }),
    registerCommand("codexAvatar.openSettings", async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:codex-avatar-studio.codex-avatar-studio-extension"
      );
    }),
    registerCommand("codexAvatar.showDebugPanel", () => {
      provider.debugEvent("debug_panel_requested");
      vscode.window.showInformationMessage("Codex Avatar debug events are shown in the assistant panel.");
    }),
    registerCommand("codexAvatar.openAssetsFolder", async () => {
      if (!requireWorkspaceTrust("open avatar assets")) return;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Open a workspace folder before opening avatar assets.");
        return;
      }

      const assetWorkspacePath = packageRegistry.getAssetRoot();
      if (!assetWorkspacePath) {
        vscode.window.showErrorMessage("Avatar assets must be stored inside the current workspace.");
        return;
      }
      const assetWorkspaceUri = vscode.Uri.file(assetWorkspacePath);

      await vscode.workspace.fs.createDirectory(assetWorkspaceUri);
      await vscode.commands.executeCommand("revealFileInOS", assetWorkspaceUri);
    }),
    registerCommand("codexAvatar.reloadAvatar", () => {
      if (!requireWorkspaceTrust("reload workspace avatar assets")) return;
      void provider.reloadAssets();
      provider.setState("success");
      provider.trigger("nod");
      vscode.window.showInformationMessage("Codex Avatar assets reloaded.");
    }),
    registerCommand("codexAvatar.importAvatar", async () => {
      if (!requireWorkspaceTrust("import an avatar package")) return;
      const selected = await vscode.window.showOpenDialog({
        title: "Codex Avatar: Import Avatar Package",
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        filters: { "Avatar package manifest": ["json"] }
      });
      const source = selected?.[0];
      if (!source) return;

      try {
        const imported = await packageRegistry.importPackage(source.fsPath);
        vscode.window.showInformationMessage(`Imported avatar package "${imported.manifest.name}".`);
      } catch (error) {
        showPackageError(error);
      }
    }),
    registerCommand("codexAvatar.removeAvatar", deleteImportedAvatar),
    registerCommand("codexAvatar.deleteImportedAvatar", deleteImportedAvatar),
    registerCommand("codexAvatar.activateAvatar", async () => {
      if (!requireWorkspaceTrust("activate an avatar package")) return;
      try {
        const packages = await packageRegistry.listPackages();
        const selected = await vscode.window.showQuickPick(
          [
            { label: "Default Coder Orb", description: "default-coder-orb", id: undefined },
            ...packages.map((avatarPackage) => ({
              label: avatarPackage.manifest.name,
              description: avatarPackage.id,
              id: avatarPackage.id
            }))
          ],
          { title: "Codex Avatar: Activate Avatar Package" }
        );
        if (!selected) return;
        await packageRegistry.activateAvatar(selected.id);
        await updateAvatarConfig({ character: selected.id ?? "default" });
        await provider.reloadAssets();
        vscode.window.showInformationMessage(`Active avatar: ${selected.label}.`);
      } catch (error) {
        showPackageError(error);
      }
    }),
    registerCommand("codexAvatar.clearCache", async () => {
      if (!requireWorkspaceTrust("clear generated avatar data")) return;
      try {
        await packageRegistry.clearGeneratedCache();
        vscode.window.showInformationMessage(
          "Generated avatar cache and previews cleared. Imported avatars and exports were kept."
        );
      } catch (error) {
        showPackageError(error);
      }
    }),
    registerCommand("codexAvatar.setState", async () => {
      const selected = await vscode.window.showQuickPick([...avatarStates], {
        title: "Codex Avatar: Set State",
        placeHolder: "Choose a state to preview"
      });

      if (selected && isAvatarState(selected)) {
        ideEvents.setManualState(selected);
      }
    }),
    registerCommand("codexAvatar.startThinking", () => {
      ideEvents.setManualState("thinking");
    }),
    registerCommand("codexAvatar.startSpeaking", () => {
      ideEvents.setManualState("speaking");
    }),
    registerCommand("codexAvatar.createFromPicture", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.codexAvatar");
      await provider.choosePicture();
    }),
    registerCommand("codexAvatar.emitEvent", (event?: unknown, payload?: unknown) => {
      if (typeof event !== "string" || !isIdeAssistantEvent(event)) {
        vscode.window.showErrorMessage(`Unsupported Codex Avatar event: ${String(event)}`);
        return;
      }
      ideEvents.emitEvent(event, payload);
    }),
    registerCommand("codexAvatar.markSuccess", () => {
      ideEvents.setManualState("success", "celebrate");
    }),
    registerCommand("codexAvatar.markError", () => {
      ideEvents.setManualState("error", "shake");
    }),
    ...(
      [
        "blink",
        "look-left",
        "look-right",
        "nod",
        "shake",
        "celebrate",
        "point",
        "start-speaking",
        "stop-speaking",
        "show-particles",
        "clear-effects"
      ] as const
    ).map((trigger) =>
      registerCommand(`codexAvatar.trigger.${trigger.replaceAll("-", "")}`, () => provider.trigger(trigger))
    ),
    registerCommand("codexAvatar.vectorizeImage", async () => {
      await vscode.commands.executeCommand("codexAvatar.createFromPicture");
    }),
    registerCommand("codexAvatar.exportBlenderScene", async () => {
      if (!requireWorkspaceTrust("export Blender avatar assets")) return;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("Open a workspace folder before exporting Blender avatar assets.");
        return;
      }

      const connection = await blenderIntegration.refresh();
      provider.postBlenderStatus(connection);
      if (!connection.executablePath || connection.support !== "supported") {
        blenderOutputChannel.show(true);
        vscode.window.showWarningMessage(connection.message);
        return;
      }

      const selectedFiles = await vscode.window.showOpenDialog({
        title: "Codex Avatar: Export Blender Scene",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          "Blender Scene": ["blend"]
        }
      });
      const selectedFile = selectedFiles?.[0];
      if (!selectedFile) {
        return;
      }

      const selectedModes = await vscode.window.showQuickPick(
        [
          { label: "SVG line art", mode: "svg" as const },
          { label: "GLB WebGL asset", mode: "glb" as const },
          { label: "PNG preview", mode: "png" as const }
        ],
        {
          title: "Choose Blender exports",
          canPickMany: true,
          placeHolder: "SVG, GLB, PNG preview"
        }
      );
      const modes = selectedModes?.map((item) => item.mode) satisfies BlenderExportMode[] | undefined;
      if (!modes || modes.length === 0) {
        return;
      }

      try {
        provider.setState("building");
        blenderOutputChannel.show(true);
        const exportPromise = blenderIntegration.runExports({ blendPath: selectedFile.fsPath, modes });
        provider.postBlenderStatus(blenderIntegration.getStatus());
        const results = await exportPromise;
        provider.recordBlenderExport(selectedFile.fsPath, results);
        const succeeded = results.filter((result) => result.status === "success");
        const failed = results.filter((result) => result.status === "failed");
        provider.postBlenderStatus(blenderIntegration.getStatus());
        if (succeeded.length > 0) {
          provider.setState(failed.length > 0 ? "warning" : "success");
          provider.trigger(failed.length > 0 ? "nod" : "celebrate");
          vscode.window.showInformationMessage(
            failed.length > 0
              ? `Blender export finished: ${succeeded.length} created, ${failed.length} failed. Open Blender Tools for details.`
              : `Blender export complete: ${succeeded.length} file(s) created.`
          );
        } else {
          provider.setState("error");
          provider.trigger("shake");
          vscode.window.showErrorMessage(
            `No Blender exports succeeded. ${failed.map((result) => `${result.mode.toUpperCase()}: ${result.message}`).join(" ")}`
          );
        }
      } catch (error) {
        provider.postBlenderStatus(blenderIntegration.getStatus());
        provider.setState("error");
        provider.trigger("shake");
        blenderOutputChannel.show(true);
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    })
  );
}

export function deactivate(): void {
  activeIdeEvents?.dispose();
  activeIdeEvents = undefined;
}

function registerCommand(command: string, callback: (...args: unknown[]) => unknown): vscode.Disposable {
  return vscode.commands.registerCommand(command, callback);
}

function showPackageError(error: unknown): void {
  const message =
    error instanceof AvatarPackageError ? error.message : error instanceof Error ? error.message : String(error);
  vscode.window.showErrorMessage(`Avatar package error: ${message}`);
}

function requireWorkspaceTrust(action: string): boolean {
  if (vscode.workspace.isTrusted) return true;
  vscode.window.showWarningMessage(`Codex Avatar cannot ${action} until the workspace is trusted.`);
  return false;
}
