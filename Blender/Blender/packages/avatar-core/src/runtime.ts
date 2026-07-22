import type { AvatarCapability, AvatarManifest, AvatarRuntimeKind, AvatarState, AvatarTrigger } from "./types.js";

export interface AvatarRuntimeAdapter {
  readonly kind: AvatarRuntimeKind;
  readonly capabilities: ReadonlySet<AvatarCapability>;

  initialize(container: HTMLElement, manifest: AvatarManifest): Promise<void>;
  setState(state: AvatarState): Promise<void> | void;
  trigger(trigger: AvatarTrigger): Promise<void> | void;
  setSpeechLevel(level: number): void;
  setVisible(visible: boolean): void;
  resize(width: number, height: number, devicePixelRatio: number): void;
  dispose(): Promise<void> | void;
}

export type RuntimeSupport = Partial<Record<AvatarRuntimeKind, boolean>>;

export function resolveAvatarRuntime(
  preferredRuntime: AvatarRuntimeKind,
  manifest: Pick<AvatarManifest, "preferredRuntime" | "fallbackRuntime" | "entrypoints" | "runtimePriority" | "assets">,
  support: RuntimeSupport = {}
): AvatarRuntimeKind {
  const candidates = uniqueRuntimes([
    preferredRuntime,
    manifest.preferredRuntime,
    ...(manifest.runtimePriority ?? []),
    manifest.fallbackRuntime,
    "svg"
  ]);

  for (const runtime of candidates) {
    const supported = support[runtime] ?? true;
    const hasAsset = runtime === "svg" || Boolean(manifest.entrypoints[runtime] ?? manifest.assets?.[runtime]);
    if (supported && hasAsset) {
      return runtime;
    }
  }

  return "svg";
}

function uniqueRuntimes(runtimes: AvatarRuntimeKind[]): AvatarRuntimeKind[] {
  return [...new Set(runtimes)];
}
