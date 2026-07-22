import { useEffect, useMemo, useState } from "react";
import type {
  AvatarConfig,
  AvatarManifest,
  AvatarPoseInput,
  AvatarState,
  AvatarTrigger,
  ExtensionToWebviewMessage
} from "./messages";
import { parseExtensionToWebviewMessage } from "./messages";
import { getBootstrap, postToExtension } from "./vscodeApi";

export type BridgeState = {
  avatarState: AvatarState;
  config: AvatarConfig;
  message: string | null;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  debugEvents: string[];
  pictureStudio: PictureStudioState;
  avatarLibrary: AvatarLibraryState;
  blenderTools: BlenderToolsState;
};

export type PictureSelection = Extract<ExtensionToWebviewMessage, { type: "studio:imageSelected" }>["selection"];
export type VectorPreview = Extract<ExtensionToWebviewMessage, { type: "studio:vectorPreview" }>;

export type AvatarLibraryEntry = Extract<ExtensionToWebviewMessage, { type: "library:updated" }>["avatars"][number];
export type AvatarLibraryStatus = Extract<ExtensionToWebviewMessage, { type: "library:status" }>;
export type AvatarLibraryValidation = Extract<ExtensionToWebviewMessage, { type: "library:validationResult" }>;

export type BlenderStatus = Extract<ExtensionToWebviewMessage, { type: "blender:status" }>;
export type BlenderOperation = Extract<ExtensionToWebviewMessage, { type: "blender:operation" }>;
export type BlenderExportResult = Extract<ExtensionToWebviewMessage, { type: "blender:exportResult" }>;
export type BlenderAvatarSaveStatus = Extract<ExtensionToWebviewMessage, { type: "blender:avatarSaveStatus" }>;
export type BlenderHandoffStatus = Extract<ExtensionToWebviewMessage, { type: "blender:handoffStatus" }>;

export type BlenderToolsState = {
  status: BlenderStatus | null;
  operation: BlenderOperation | null;
  exportResult: BlenderExportResult | null;
  avatarSave: BlenderAvatarSaveStatus | null;
};

export function reduceBlenderToolsState(
  previous: BlenderToolsState,
  message: BlenderStatus | BlenderOperation | BlenderExportResult | BlenderAvatarSaveStatus
): BlenderToolsState {
  if (message.type === "blender:status") {
    return {
      ...previous,
      status: message,
      operation: !message.busy && previous.operation?.tone === "working" ? null : previous.operation
    };
  }

  if (message.type === "blender:exportResult") {
    return { ...previous, exportResult: message, avatarSave: null };
  }

  if (message.type === "blender:avatarSaveStatus") {
    return { ...previous, avatarSave: message };
  }

  return {
    ...previous,
    status: previous.status ? { ...previous.status, busy: message.tone === "working" } : previous.status,
    operation: message
  };
}

export type AvatarLibraryState = {
  loaded: boolean;
  workspaceAvailable: boolean;
  workspaceTrusted: boolean;
  activeId: string | null;
  avatars: AvatarLibraryEntry[];
  status: AvatarLibraryStatus | null;
  validation: AvatarLibraryValidation | null;
};

export type VectorizationState =
  | { status: "idle"; revision: number; message?: string }
  | {
      status: "working";
      revision: number;
      stage: Extract<ExtensionToWebviewMessage, { type: "studio:vectorProgress" }>["stage"];
      message: string;
      progress: number;
    }
  | { status: "ready"; revision: number; preview: VectorPreview }
  | {
      status: "error";
      revision: number;
      code: Extract<ExtensionToWebviewMessage, { type: "studio:vectorError" }>["code"];
      message: string;
      recoverable: boolean;
    };

export type PackageSaveState =
  | { status: "idle" }
  | {
      status: "working";
      revision: number;
      stage: Extract<ExtensionToWebviewMessage, { type: "studio:packageProgress" }>["stage"];
      message: string;
      progress: number;
    }
  | {
      status: "collision";
      revision: number;
      id: string;
      suggestedCopyId: string;
    }
  | {
      status: "success";
      revision: number;
      avatar: Extract<ExtensionToWebviewMessage, { type: "studio:packageSaved" }>["avatar"];
    }
  | {
      status: "error";
      revision: number;
      code: Extract<ExtensionToWebviewMessage, { type: "studio:packageError" }>["code"];
      message: string;
      recoverable: boolean;
    };

export type PictureStudioState = {
  status: "idle" | "working" | "preview" | "error";
  selection: PictureSelection | null;
  stage?: "selecting" | "validating" | "copying" | undefined;
  message?: string | undefined;
  progress?: number | undefined;
  vectorization: VectorizationState;
  packageSave: PackageSaveState;
  blenderHandoff?: BlenderHandoffStatus | undefined;
  error?:
    | {
        code: Extract<ExtensionToWebviewMessage, { type: "studio:imageError" }>["code"];
        message: string;
        recoverable: boolean;
      }
    | undefined;
};

export function useExtensionBridge(): BridgeState {
  const bootstrap = useMemo(() => getBootstrap(), []);
  const [avatarState, setAvatarState] = useState<AvatarState>("welcome");
  const [config, setConfig] = useState<AvatarConfig>(bootstrap.config);
  const [message, setMessage] = useState<string | null>("Ready to build.");
  const [poseInput, setPoseInput] = useState<AvatarPoseInput>({});
  const [manifest, setManifest] = useState<AvatarManifest>(bootstrap.manifest);
  const [triggerEvent, setTriggerEvent] = useState<{ trigger: AvatarTrigger; sequence: number } | null>(null);
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const [pictureStudio, setPictureStudio] = useState<PictureStudioState>({
    status: "idle",
    selection: null,
    vectorization: { status: "idle", revision: 0 },
    packageSave: { status: "idle" }
  });
  const [avatarLibrary, setAvatarLibrary] = useState<AvatarLibraryState>({
    loaded: false,
    workspaceAvailable: false,
    workspaceTrusted: false,
    activeId: null,
    avatars: [],
    status: null,
    validation: null
  });
  const [blenderTools, setBlenderTools] = useState<BlenderToolsState>({
    status: null,
    operation: null,
    exportResult: null,
    avatarSave: null
  });

  useEffect(() => {
    postToExtension({ type: "webview:ready" });

    const handleMessage = (event: MessageEvent<unknown>) => {
      const parsed = parseExtensionToWebviewMessage(event.data);
      if (!parsed.success) {
        console.warn("[Codex Avatar] Rejected extension message", parsed.error.issues);
        return;
      }

      const nextMessage = parsed.data;

      switch (nextMessage.type) {
        case "avatar:setState":
          setAvatarState(nextMessage.state);
          setMessage(messageForState(nextMessage.state));
          break;
        case "avatar:setMessage":
          setMessage(nextMessage.text);
          break;
        case "avatar:setPoseInput":
          setPoseInput(nextMessage.input);
          break;
        case "assets:manifestLoaded":
          setManifest(nextMessage.manifest);
          break;
        case "blender:status":
          setBlenderTools((previous) => reduceBlenderToolsState(previous, nextMessage));
          break;
        case "blender:operation":
          setBlenderTools((previous) => reduceBlenderToolsState(previous, nextMessage));
          break;
        case "blender:exportResult":
        case "blender:avatarSaveStatus":
          setBlenderTools((previous) => reduceBlenderToolsState(previous, nextMessage));
          break;
        case "blender:handoffStatus":
          setPictureStudio((previous) =>
            previous.selection?.jobId === nextMessage.jobId ? { ...previous, blenderHandoff: nextMessage } : previous
          );
          break;
        case "library:updated":
          setAvatarLibrary((previous) => ({
            ...previous,
            loaded: true,
            workspaceAvailable: nextMessage.workspaceAvailable,
            workspaceTrusted: nextMessage.workspaceTrusted,
            activeId: nextMessage.activeId,
            avatars: nextMessage.avatars,
            validation:
              previous.validation && nextMessage.avatars.some((avatar) => avatar.id === previous.validation?.id)
                ? previous.validation
                : null
          }));
          break;
        case "library:status":
          setAvatarLibrary((previous) => ({
            ...previous,
            status: nextMessage,
            validation:
              nextMessage.operation === "validate" && nextMessage.tone === "working" ? null : previous.validation
          }));
          break;
        case "library:validationResult":
          setAvatarLibrary((previous) => ({ ...previous, validation: nextMessage }));
          break;
        case "studio:imageProgress":
          setPictureStudio((previous) => ({
            ...previous,
            status: "working",
            stage: nextMessage.stage,
            message: nextMessage.message,
            progress: nextMessage.progress,
            error: undefined
          }));
          break;
        case "studio:imageSelected":
          setPictureStudio({
            status: "preview",
            selection: nextMessage.selection,
            message: "Picture ready for review.",
            progress: 1,
            vectorization: { status: "idle", revision: 0 },
            packageSave: { status: "idle" }
          });
          break;
        case "studio:imageCancelled":
          setPictureStudio((previous) =>
            nextMessage.reason === "picker" && previous.selection
              ? { ...previous, status: "preview", message: "Picture selection kept." }
              : {
                  status: "idle",
                  selection: null,
                  vectorization: { status: "idle", revision: 0 },
                  packageSave: { status: "idle" },
                  blenderHandoff: undefined
                }
          );
          break;
        case "studio:imageError":
          setPictureStudio((previous) => ({
            ...previous,
            status: "error",
            selection: previous.selection,
            error: {
              code: nextMessage.code,
              message: nextMessage.message,
              recoverable: nextMessage.recoverable
            }
          }));
          break;
        case "studio:vectorProgress":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId || previous.vectorization.revision > nextMessage.revision
              ? previous
              : {
                  ...previous,
                  vectorization: {
                    status: "working",
                    revision: nextMessage.revision,
                    stage: nextMessage.stage,
                    message: nextMessage.message,
                    progress: nextMessage.progress
                  },
                  packageSave: { status: "idle" },
                  blenderHandoff: undefined
                }
          );
          break;
        case "studio:vectorPreview":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId || previous.vectorization.revision > nextMessage.revision
              ? previous
              : {
                  ...previous,
                  vectorization: { status: "ready", revision: nextMessage.revision, preview: nextMessage },
                  packageSave: { status: "idle" }
                }
          );
          break;
        case "studio:vectorCancelled":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId || previous.vectorization.revision > nextMessage.revision
              ? previous
              : {
                  ...previous,
                  vectorization: {
                    status: "idle",
                    revision: nextMessage.revision,
                    message: "Conversion cancelled. Adjust the settings and try again."
                  }
                }
          );
          break;
        case "studio:vectorError":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId || previous.vectorization.revision > nextMessage.revision
              ? previous
              : {
                  ...previous,
                  vectorization: {
                    status: "error",
                    revision: nextMessage.revision,
                    code: nextMessage.code,
                    message: nextMessage.message,
                    recoverable: nextMessage.recoverable
                  }
                }
          );
          break;
        case "studio:packageProgress":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId
              ? previous
              : {
                  ...previous,
                  packageSave: {
                    status: "working",
                    revision: nextMessage.revision,
                    stage: nextMessage.stage,
                    message: nextMessage.message,
                    progress: nextMessage.progress
                  }
                }
          );
          break;
        case "studio:packageCollision":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId
              ? previous
              : {
                  ...previous,
                  packageSave: {
                    status: "collision",
                    revision: nextMessage.revision,
                    id: nextMessage.id,
                    suggestedCopyId: nextMessage.suggestedCopyId
                  }
                }
          );
          break;
        case "studio:packageSaved":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId
              ? previous
              : {
                  ...previous,
                  packageSave: {
                    status: "success",
                    revision: nextMessage.revision,
                    avatar: nextMessage.avatar
                  }
                }
          );
          break;
        case "studio:packageError":
          setPictureStudio((previous) =>
            previous.selection?.jobId !== nextMessage.jobId
              ? previous
              : {
                  ...previous,
                  packageSave: {
                    status: "error",
                    revision: nextMessage.revision,
                    code: nextMessage.code,
                    message: nextMessage.message,
                    recoverable: nextMessage.recoverable
                  }
                }
          );
          break;
        case "settings:update":
          setConfig(nextMessage.config);
          break;
        case "debug:event":
          setDebugEvents((previous) => [nextMessage.event, ...previous].slice(0, 5));
          break;
        case "avatar:trigger":
          setTriggerEvent((previous) => ({
            trigger: nextMessage.trigger,
            sequence: (previous?.sequence ?? 0) + 1
          }));
          setDebugEvents((previous) => [`trigger:${nextMessage.trigger}`, ...previous].slice(0, 5));
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return {
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
  };
}

function messageForState(state: AvatarState): string {
  const messages: Record<AvatarState, string> = {
    idle: "Ready.",
    welcome: "Ready to build.",
    listening: "Listening.",
    thinking: "Thinking.",
    speaking: "Answering.",
    coding: "Coding.",
    reviewing: "Reviewing.",
    debugging: "Debugging.",
    building: "Building.",
    success: "Done.",
    warning: "Needs attention.",
    error: "Error detected.",
    sleeping: "Quiet mode."
  };

  return messages[state];
}
