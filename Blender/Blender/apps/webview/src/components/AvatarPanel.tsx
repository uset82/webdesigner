import { useState } from "react";
import { postToExtension } from "../bridge/vscodeApi";
import { AssetManagerPanel } from "./AssetManagerPanel";
import { AssistantBubble } from "./AssistantBubble";
import { AvatarStage } from "./AvatarStage";
import { BlenderToolsPanel } from "./BlenderToolsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { StatusDebugPanel } from "./StatusDebugPanel";
import { PictureStudioPanel } from "./PictureStudioPanel";
import type { BridgeState } from "../bridge/useExtensionBridge";
import { useAvatarBehavior } from "../hooks/useAvatarBehavior";
import { AvatarRuntimeBoundary } from "./AvatarRuntimeBoundary";

type AvatarPanelProps = BridgeState;

export function AvatarPanel({
  avatarState,
  config,
  message,
  poseInput,
  manifest,
  triggerEvent,
  debugEvents,
  pictureStudio,
  avatarLibrary,
  blenderTools
}: AvatarPanelProps) {
  const [blenderToolsOpen, setBlenderToolsOpen] = useState(false);
  const behavior = useAvatarBehavior({
    externalState: avatarState,
    externalMessage: message,
    externalPoseInput: poseInput,
    config,
    triggerEvent
  });
  const workspaceReason = getWorkspaceReason(avatarLibrary);

  return (
    <main
      className="avatar-panel"
      data-enabled={String(config.enabled)}
      data-focus-mode={String(config.focusMode)}
      data-no-animation={String(config.noAnimation)}
      data-intensity={config.noAnimation || config.focusMode ? "low" : config.animationIntensity}
      data-position={config.position}
    >
      <AvatarRuntimeBoundary>
        <AvatarStage
          state={behavior.displayState}
          config={config}
          poseInput={behavior.poseInput}
          manifest={manifest}
          triggerEvent={behavior.triggerEvent}
        />
      </AvatarRuntimeBoundary>
      <AssistantBubble text={behavior.displayMessage} />
      <nav className="action-row" aria-label="Avatar actions">
        <button
          type="button"
          disabled={Boolean(workspaceReason)}
          title={workspaceReason ?? undefined}
          aria-describedby={workspaceReason ? "avatar-tools-availability" : undefined}
          onClick={() => postToExtension({ type: "studio:chooseImage" })}
        >
          Create from Picture
        </button>
        <button
          type="button"
          disabled={Boolean(workspaceReason)}
          title={workspaceReason ?? undefined}
          aria-describedby={workspaceReason ? "avatar-tools-availability" : undefined}
          onClick={() => postToExtension({ type: "library:import" })}
        >
          Import Avatar
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-expanded={blenderToolsOpen}
          aria-controls="blender-tools-panel"
          onClick={() => setBlenderToolsOpen((open) => !open)}
        >
          Blender Tools
        </button>
      </nav>
      {workspaceReason ? (
        <p id="avatar-tools-availability" className="action-availability" role="status">
          {workspaceReason}
        </p>
      ) : null}
      {blenderToolsOpen ? <BlenderToolsPanel tools={blenderTools} unavailableReason={workspaceReason} /> : null}
      <PictureStudioPanel key={pictureStudio.selection?.jobId ?? "picture-studio"} studio={pictureStudio} />
      <AssetManagerPanel library={avatarLibrary} />
      <SettingsPanel config={config} />
      {config.debugOverlay ? <StatusDebugPanel events={debugEvents} /> : null}
    </main>
  );
}

function getWorkspaceReason(library: AvatarPanelProps["avatarLibrary"]): string | null {
  if (!library.loaded) return "Checking the workspace before enabling local avatar tools.";
  if (!library.workspaceAvailable) return "Open a project folder to use local avatar tools.";
  if (!library.workspaceTrusted) return "Trust this workspace to use local avatar tools.";
  return null;
}
