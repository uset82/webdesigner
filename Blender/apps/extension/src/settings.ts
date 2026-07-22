import * as vscode from "vscode";
import type { AvatarConfigPatch, AvatarExtensionConfig } from "./avatarState.js";

export const defaultAvatarConfig: AvatarExtensionConfig = {
  enabled: true,
  runtime: "svg",
  position: "activity-bar-view",
  character: "default",
  animationIntensity: "medium",
  frameRate: 30,
  particleEffects: true,
  soundEnabled: false,
  lipSyncEnabled: false,
  idleTimeout: 15,
  sleepTimeout: 300,
  debugOverlay: false,
  noAnimation: false,
  focusMode: false,
  showSpeechBubble: true,
  respectReducedMotion: true,
  blenderPath: "",
  assetWorkspace: ".codex-avatar"
};

const avatarConfigKeys = Object.keys(defaultAvatarConfig) as Array<keyof AvatarExtensionConfig>;
const extensionOnlyConfigKeys = ["blenderTimeoutSeconds"] as const;
export const selectableAvatarRuntimes = ["svg", "pixi", "webgl"] as const;
const positions = ["activity-bar-view", "side-panel", "bottom-right", "bottom-left"] as const;
const animationIntensities = ["low", "medium", "high"] as const;

export function getAvatarConfig(): AvatarExtensionConfig {
  const config = vscode.workspace.getConfiguration("codexAvatar");
  const runtime = config.get<string>("runtime", defaultAvatarConfig.runtime);
  const position = config.get<string>("position", defaultAvatarConfig.position);
  const animationIntensity = config.get<string>("animationIntensity", defaultAvatarConfig.animationIntensity);
  const frameRate = config.get<number>("frameRate", defaultAvatarConfig.frameRate);
  const idleTimeout = config.get<number>("idleTimeout", defaultAvatarConfig.idleTimeout);
  const sleepTimeout = config.get<number>("sleepTimeout", defaultAvatarConfig.sleepTimeout);

  return {
    enabled: readBoolean(config.get("enabled", defaultAvatarConfig.enabled), defaultAvatarConfig.enabled),
    runtime: isSelectableAvatarRuntime(runtime) ? runtime : defaultAvatarConfig.runtime,
    position: isPosition(position) ? position : defaultAvatarConfig.position,
    character: readNonEmptyString(
      config.get("character", defaultAvatarConfig.character),
      defaultAvatarConfig.character
    ),
    animationIntensity: isAnimationIntensity(animationIntensity)
      ? animationIntensity
      : defaultAvatarConfig.animationIntensity,
    frameRate: frameRate === 60 ? 60 : defaultAvatarConfig.frameRate,
    particleEffects: readBoolean(config.get("particleEffects", defaultAvatarConfig.particleEffects), true),
    soundEnabled: readBoolean(config.get("soundEnabled", defaultAvatarConfig.soundEnabled), false),
    lipSyncEnabled: readBoolean(config.get("lipSyncEnabled", defaultAvatarConfig.lipSyncEnabled), false),
    idleTimeout: readTimeout(idleTimeout, defaultAvatarConfig.idleTimeout),
    sleepTimeout: readTimeout(sleepTimeout, defaultAvatarConfig.sleepTimeout),
    debugOverlay: readBoolean(config.get("debugOverlay", defaultAvatarConfig.debugOverlay), false),
    noAnimation: readBoolean(config.get("noAnimation", defaultAvatarConfig.noAnimation), false),
    focusMode: readBoolean(config.get("focusMode", defaultAvatarConfig.focusMode), false),
    showSpeechBubble: readBoolean(config.get("showSpeechBubble", defaultAvatarConfig.showSpeechBubble), true),
    respectReducedMotion: readBoolean(
      config.get("respectReducedMotion", defaultAvatarConfig.respectReducedMotion),
      true
    ),
    blenderPath: config.get("blenderPath", defaultAvatarConfig.blenderPath),
    assetWorkspace: config.get("assetWorkspace", defaultAvatarConfig.assetWorkspace)
  };
}

export async function toggleAssistantEnabled(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("codexAvatar");
  const nextEnabled = !config.get("enabled", true);
  await config.update("enabled", nextEnabled, vscode.ConfigurationTarget.Global);
  return nextEnabled;
}

export async function updateAvatarConfig(nextConfig: AvatarConfigPatch): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexAvatar");
  const entries = Object.entries(sanitizeAvatarConfigPatch(nextConfig)) as [
    keyof AvatarExtensionConfig,
    AvatarExtensionConfig[keyof AvatarExtensionConfig]
  ][];

  await Promise.all(
    entries.map(([key, value]) =>
      config.update(
        key,
        value,
        (key === "character" || key === "runtime") && vscode.workspace.workspaceFolders?.length
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global
      )
    )
  );
}

export async function resetAvatarConfig(): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexAvatar");

  await Promise.all(
    [...avatarConfigKeys, ...extensionOnlyConfigKeys].flatMap((key) => {
      const resets = [config.update(key, undefined, vscode.ConfigurationTarget.Global)];
      if ((key === "character" || key === "runtime") && vscode.workspace.workspaceFolders?.length) {
        resets.push(config.update(key, undefined, vscode.ConfigurationTarget.Workspace));
      }
      return resets;
    })
  );
}

function sanitizeAvatarConfigPatch(nextConfig: AvatarConfigPatch): AvatarConfigPatch {
  const sanitized: AvatarConfigPatch = {};

  if (typeof nextConfig.enabled === "boolean") {
    sanitized.enabled = nextConfig.enabled;
  }
  if (typeof nextConfig.runtime === "string" && isSelectableAvatarRuntime(nextConfig.runtime)) {
    sanitized.runtime = nextConfig.runtime;
  }
  if (typeof nextConfig.position === "string" && isPosition(nextConfig.position)) {
    sanitized.position = nextConfig.position;
  }
  if (typeof nextConfig.character === "string" && nextConfig.character.trim().length > 0) {
    sanitized.character = nextConfig.character.trim();
  }
  if (typeof nextConfig.animationIntensity === "string" && isAnimationIntensity(nextConfig.animationIntensity)) {
    sanitized.animationIntensity = nextConfig.animationIntensity;
  }
  if (nextConfig.frameRate === 30 || nextConfig.frameRate === 60) sanitized.frameRate = nextConfig.frameRate;
  if (typeof nextConfig.particleEffects === "boolean") sanitized.particleEffects = nextConfig.particleEffects;
  if (typeof nextConfig.soundEnabled === "boolean") sanitized.soundEnabled = nextConfig.soundEnabled;
  if (typeof nextConfig.lipSyncEnabled === "boolean") sanitized.lipSyncEnabled = nextConfig.lipSyncEnabled;
  if (
    typeof nextConfig.idleTimeout === "number" &&
    Number.isFinite(nextConfig.idleTimeout) &&
    nextConfig.idleTimeout >= 0
  ) {
    sanitized.idleTimeout = Math.min(nextConfig.idleTimeout, 86_400);
  }
  if (
    typeof nextConfig.sleepTimeout === "number" &&
    Number.isFinite(nextConfig.sleepTimeout) &&
    nextConfig.sleepTimeout >= 0
  ) {
    sanitized.sleepTimeout = Math.min(nextConfig.sleepTimeout, 86_400);
  }
  if (typeof nextConfig.debugOverlay === "boolean") sanitized.debugOverlay = nextConfig.debugOverlay;
  if (typeof nextConfig.noAnimation === "boolean") sanitized.noAnimation = nextConfig.noAnimation;
  if (typeof nextConfig.focusMode === "boolean") {
    sanitized.focusMode = nextConfig.focusMode;
  }
  if (typeof nextConfig.showSpeechBubble === "boolean") {
    sanitized.showSpeechBubble = nextConfig.showSpeechBubble;
  }
  if (typeof nextConfig.respectReducedMotion === "boolean") {
    sanitized.respectReducedMotion = nextConfig.respectReducedMotion;
  }
  if (typeof nextConfig.blenderPath === "string") {
    sanitized.blenderPath = nextConfig.blenderPath;
  }
  if (typeof nextConfig.assetWorkspace === "string" && nextConfig.assetWorkspace.trim().length > 0) {
    sanitized.assetWorkspace = nextConfig.assetWorkspace.trim();
  }

  return sanitized;
}

function isPosition(value: string): value is AvatarExtensionConfig["position"] {
  return (positions as readonly string[]).includes(value);
}

function isSelectableAvatarRuntime(value: string): value is (typeof selectableAvatarRuntimes)[number] {
  return (selectableAvatarRuntimes as readonly string[]).includes(value);
}

function isAnimationIntensity(value: string): value is AvatarExtensionConfig["animationIntensity"] {
  return (animationIntensities as readonly string[]).includes(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readTimeout(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, 86_400) : fallback;
}
