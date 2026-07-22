/**
 * Runtime kinds understood by manifests and the shared protocol. SVG, Pixi,
 * and WebGL are selectable product runtimes; the remaining values preserve
 * compatibility for optional adapters that are still isolated or deferred.
 */
export const avatarRuntimeKinds = ["svg", "pixi", "inochi2d", "live2d", "vrm", "rive", "webgl", "webgpu"] as const;
export type AvatarRuntimeKind = (typeof avatarRuntimeKinds)[number];

/** @deprecated Use AvatarRuntimeKind. */
export const avatarRuntimes = avatarRuntimeKinds;
/** @deprecated Use AvatarRuntimeKind. */
export type AvatarRuntime = AvatarRuntimeKind;

export const avatarStates = [
  "idle",
  "welcome",
  "listening",
  "thinking",
  "speaking",
  "coding",
  "reviewing",
  "debugging",
  "building",
  "success",
  "warning",
  "error",
  "sleeping"
] as const;
export type AvatarState = (typeof avatarStates)[number];

export const avatarTriggers = [
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
] as const;
export type AvatarTrigger = (typeof avatarTriggers)[number];

export const avatarCapabilities = [
  "state-animation",
  "one-shot-triggers",
  "speech-level",
  "reduced-motion",
  "gaze",
  "particles"
] as const;
export type AvatarCapability = (typeof avatarCapabilities)[number];

export const ideAssistantEvents = [
  "extension_ready",
  "active_editor_changed",
  "text_document_changed",
  "file_saved",
  "diagnostics_changed",
  "terminal_started",
  "terminal_finished",
  "task_started",
  "task_finished",
  "task_failed",
  "debug_started",
  "debug_stopped",
  "workspace_trust_changed",
  "codex_task_started",
  "codex_task_thinking",
  "codex_task_streaming",
  "codex_task_finished",
  "codex_task_failed",
  "user_message_started",
  "user_message_sent",
  "assistant_message_started",
  "assistant_message_streaming",
  "assistant_message_finished"
] as const;
export type IdeAssistantEvent = (typeof ideAssistantEvents)[number];

export type AvatarMood = "neutral" | "focused" | "curious" | "happy" | "concerned" | "confused" | "sleepy";

export type AvatarMessage = {
  id: string;
  text: string;
  tone?: AvatarMood;
  createdAt: number;
  ttlMs?: number;
};

export type AvatarPoseInput = {
  cursorX?: number | undefined;
  cursorY?: number | undefined;
  mouthOpen?: number | undefined;
  scrollProgress?: number | undefined;
  audioLevel?: number | undefined;
  speechLevel?: number | undefined;
};

export const live2dParameterChannels = ["mouthOpen", "angleX", "angleY", "breath"] as const;
export type Live2DParameterChannel = (typeof live2dParameterChannels)[number];
export type Live2DParameterMap = Partial<Record<Live2DParameterChannel, string>>;
export type Live2DStateMap = Partial<Record<AvatarState, string>>;

export type Live2DManifestOptions = {
  model3: string;
  model?: string | undefined;
  parameters?: Live2DParameterMap | undefined;
  motions?: Live2DStateMap | undefined;
  expressions?: Live2DStateMap | undefined;
};

export type AvatarConfig = {
  enabled: boolean;
  runtime: AvatarRuntimeKind;
  position: "bottom-right" | "bottom-left" | "side-panel" | "activity-bar-view";
  character: string;
  animationIntensity: "low" | "medium" | "high";
  frameRate: 30 | 60;
  particleEffects: boolean;
  soundEnabled: boolean;
  lipSyncEnabled: boolean;
  idleTimeout: number;
  sleepTimeout: number;
  debugOverlay: boolean;
  noAnimation: boolean;
  focusMode: boolean;
  showSpeechBubble: boolean;
  respectReducedMotion: boolean;
  blenderPath: string;
  assetWorkspace: string;
};

export type AvatarConfigPatch = {
  [Key in keyof AvatarConfig]?: AvatarConfig[Key] | undefined;
};

export type AvatarManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  preferredRuntime: AvatarRuntimeKind;
  fallbackRuntime: AvatarRuntimeKind;
  entrypoints: Partial<Record<AvatarRuntimeKind, string>>;
  capabilities: AvatarCapability[];
  states: Partial<Record<AvatarState, string>>;
  triggers?: Partial<Record<AvatarTrigger, string>> | undefined;
  previewImage?: string | undefined;
  checksums?: Record<string, string> | undefined;

  /** Compatibility fields retained for the pre-migration user baseline. */
  runtimePriority?: AvatarRuntimeKind[] | undefined;
  assets?: Partial<Record<AvatarRuntimeKind, string>> | undefined;
  rive?:
    | {
        stateMachine: string;
        inputs: Partial<
          Record<
            | "state"
            | "cursorX"
            | "cursorY"
            | "mouthOpen"
            | "scrollProgress"
            | "isSpeaking"
            | "isThinking"
            | AvatarTrigger,
            string
          >
        >;
      }
    | undefined;
  live2d?: Live2DManifestOptions | undefined;
};

export type AvatarManifestValidationResult = {
  valid: boolean;
  manifest?: AvatarManifest;
  errors: string[];
  warnings: string[];
};

export function isAvatarRuntime(value: string): value is AvatarRuntimeKind {
  return (avatarRuntimeKinds as readonly string[]).includes(value);
}

export function isAvatarState(value: string): value is AvatarState {
  return (avatarStates as readonly string[]).includes(value);
}

export function isAvatarTrigger(value: string): value is AvatarTrigger {
  return (avatarTriggers as readonly string[]).includes(value);
}

export function isIdeAssistantEvent(value: string): value is IdeAssistantEvent {
  return (ideAssistantEvents as readonly string[]).includes(value);
}
