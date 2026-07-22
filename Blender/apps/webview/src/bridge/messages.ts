export {
  avatarCapabilities,
  avatarRuntimeKinds,
  avatarStates,
  avatarTriggers,
  createExtensionToWebviewMessage,
  createWebviewToExtensionMessage,
  isAvatarRuntime,
  isAvatarState,
  isAvatarTrigger,
  parseExtensionToWebviewMessage,
  parseWebviewToExtensionMessage,
  type AvatarCapability,
  type AvatarConfig,
  type AvatarManifest,
  type AvatarRuntime,
  type AvatarRuntimeKind,
  type AvatarState,
  type AvatarTrigger,
  type ExtensionToWebviewMessage,
  type ExtensionToWebviewMessageInput,
  type GeneratedAvatarMetadata,
  type VectorizeStudioOptions,
  type WebviewToExtensionMessage,
  type WebviewToExtensionMessageInput
} from "@codex-avatar-studio/avatar-core";

export type AvatarPoseInput = import("@codex-avatar-studio/avatar-core").AvatarPoseInput;

export type WebviewBootstrap = {
  config: import("@codex-avatar-studio/avatar-core").AvatarConfig;
  placeholderAvatarUri: string;
  manifest: import("@codex-avatar-studio/avatar-core").AvatarManifest;
};
