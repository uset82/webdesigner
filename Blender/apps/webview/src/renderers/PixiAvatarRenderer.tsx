import { useEffect, useRef, useState } from "react";
import type { AvatarConfig, AvatarManifest, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";

type PixiAvatarRuntime = import("@codex-avatar-studio/runtime-pixi").PixiAvatarRuntime;

const PIXI_INITIALIZATION_TIMEOUT_MS = 8_000;

type PixiAvatarRendererProps = {
  state: AvatarState;
  config: AvatarConfig;
  manifest: AvatarManifest;
  poseInput: AvatarPoseInput;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  pageVisible: boolean;
  reducedMotion: boolean;
  intensity: "low" | "medium" | "high";
  focusMode: boolean;
  onError: (error: Error) => void;
};

export function PixiAvatarRenderer({
  state,
  config,
  manifest,
  poseInput,
  triggerEvent,
  pageVisible,
  reducedMotion,
  intensity,
  focusMode,
  onError
}: PixiAvatarRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PixiAvatarRuntime | null>(null);
  const onErrorRef = useRef(onError);
  const manifestRef = useRef(manifest);
  const stateRef = useRef(state);
  const pageVisibleRef = useRef(pageVisible);
  const [loading, setLoading] = useState(true);
  onErrorRef.current = onError;
  manifestRef.current = manifest;
  stateRef.current = state;
  pageVisibleRef.current = pageVisible;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let runtime: PixiAvatarRuntime | undefined;
    setLoading(true);

    void import("@codex-avatar-studio/runtime-pixi")
      .then(async ({ PixiAvatarRuntime }) => {
        if (cancelled) return;

        runtime = new PixiAvatarRuntime({
          maxFps: config.frameRate,
          lowPerformance: intensity === "low" || focusMode,
          particlesEnabled: config.particleEffects && !config.noAnimation,
          reducedMotion,
          initializeTimeoutMs: PIXI_INITIALIZATION_TIMEOUT_MS
        });
        runtimeRef.current = runtime;

        try {
          await runtime.initialize(container, manifestRef.current);
          if (cancelled) {
            await runtime.dispose();
            return;
          }
          runtime.setState(stateRef.current);
          runtime.setVisible(pageVisibleRef.current);
          setLoading(false);
        } catch (error) {
          await runtime.dispose();
          runtimeRef.current = null;
          if (!cancelled) onErrorRef.current(toError(error));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) onErrorRef.current(toError(error));
      });

    return () => {
      cancelled = true;
      const activeRuntime = runtimeRef.current;
      runtimeRef.current = null;
      if (activeRuntime) void activeRuntime.dispose();
    };
  }, [config.frameRate, config.noAnimation, config.particleEffects, intensity, focusMode, reducedMotion]);

  useEffect(() => {
    runtimeRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    const speechLevel = poseInput.speechLevel ?? poseInput.audioLevel ?? 0;
    runtimeRef.current?.setSpeechLevel(config.lipSyncEnabled ? speechLevel : 0);
  }, [config.lipSyncEnabled, poseInput.audioLevel, poseInput.speechLevel]);

  useEffect(() => {
    runtimeRef.current?.setPoseInput({ cursorX: poseInput.cursorX, cursorY: poseInput.cursorY });
  }, [poseInput.cursorX, poseInput.cursorY]);

  useEffect(() => {
    runtimeRef.current?.setVisible(pageVisible);
  }, [pageVisible]);

  useEffect(() => {
    if (triggerEvent) runtimeRef.current?.trigger(triggerEvent.trigger);
  }, [triggerEvent]);

  return (
    <div
      className="avatar-shell pixi-avatar-shell"
      data-avatar-state={state}
      data-runtime={config.runtime}
      data-reduced-motion={String(reducedMotion)}
      data-intensity={intensity}
      data-focus-mode={String(focusMode)}
      aria-busy={loading}
      role="img"
      aria-label={`Pixi avatar: ${state}`}
    >
      <div ref={containerRef} className="pixi-canvas-container" aria-hidden="true" />
      {loading ? <span className="avatar-runtime-loading">Loading avatar…</span> : null}
    </div>
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
