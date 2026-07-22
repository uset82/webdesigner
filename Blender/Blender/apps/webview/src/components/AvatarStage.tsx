import { supportsWebGL2 } from "@codex-avatar-studio/avatar-core";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import type { AvatarConfig, AvatarManifest, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { useSystemReducedMotion } from "../hooks/useSystemReducedMotion";
import { LayeredMascotRenderer, shouldUseLayeredMascot } from "../renderers/LayeredMascotRenderer";
import { PixiAvatarRenderer } from "../renderers/PixiAvatarRenderer";
import { RuntimeBoundary } from "../renderers/RuntimeBoundary";
import { resolveManifestSvgUri, SvgAvatarRenderer } from "../renderers/SvgAvatarRenderer";

const LazyWebGLAvatarRenderer = lazy(async () => {
  const module = await import("../renderers/WebGLAvatarRenderer");
  return { default: module.WebGLAvatarRenderer };
});

type AvatarStageProps = {
  state: AvatarState;
  config: AvatarConfig;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
};

/**
 * PixiJS is loaded only when selected. SVG remains the immediate fallback for
 * unsupported environments or initialization failures.
 */
export function AvatarStage({ state, config, poseInput, manifest, triggerEvent }: AvatarStageProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const pageVisible = usePageVisibility();
  const webglSupported = useMemo(safeSupportsWebGL2, []);
  const reducedMotion = config.noAnimation || !pageVisible || (config.respectReducedMotion && systemReducedMotion);
  const effectiveIntensity = config.noAnimation || config.focusMode ? "low" : config.animationIntensity;
  const svgAssetUri = resolveManifestSvgUri(manifest);
  const pixiAssetUri = manifest.entrypoints.pixi ?? manifest.assets?.pixi;
  const webglAssetUri = manifest.entrypoints.webgl ?? manifest.assets?.webgl;
  const runtimeAssetUri =
    config.runtime === "pixi" ? pixiAssetUri : config.runtime === "webgl" ? webglAssetUri : svgAssetUri;
  const runtimeKey = `${config.runtime}:${manifest.id}:${runtimeAssetUri ?? "built-in"}`;
  const [pixiFailureKey, setPixiFailureKey] = useState<string | null>(null);
  const pixiFailed = pixiFailureKey === runtimeKey;
  const handlePixiError = useCallback(() => setPixiFailureKey(runtimeKey), [runtimeKey]);

  const svgFallback = (
    <SvgAvatarRenderer
      key={svgAssetUri ?? "built-in-svg"}
      state={state}
      poseInput={poseInput}
      reducedMotion={reducedMotion}
      intensity={effectiveIntensity}
      focusMode={config.focusMode}
      lipSyncEnabled={config.lipSyncEnabled}
      assetUri={svgAssetUri}
    />
  );
  const usePixi = config.runtime === "pixi" && Boolean(pixiAssetUri) && !pixiFailed;
  const useWebgl = config.runtime === "webgl" && Boolean(webglAssetUri) && webglSupported;
  const useLayered = shouldUseLayeredMascot(manifest);

  return (
    <section className="avatar-stage" data-page-visible={String(pageVisible)} aria-label="Avatar status">
      {useWebgl ? (
        <RuntimeBoundary fallback={svgFallback} resetKey={runtimeKey}>
          <Suspense fallback={svgFallback}>
            <LazyWebGLAvatarRenderer
              requestedRuntime="webgl"
              state={state}
              poseInput={poseInput}
              manifest={manifest}
              triggerEvent={triggerEvent}
              fallback={svgFallback}
              pageVisible={pageVisible}
              reducedMotion={reducedMotion}
              focusMode={config.focusMode}
              frameRate={config.frameRate}
            />
          </Suspense>
        </RuntimeBoundary>
      ) : usePixi ? (
        <RuntimeBoundary fallback={svgFallback} resetKey={runtimeKey}>
          <PixiAvatarRenderer
            key={runtimeKey}
            state={state}
            config={config}
            manifest={manifest}
            poseInput={poseInput}
            triggerEvent={triggerEvent}
            pageVisible={pageVisible}
            reducedMotion={reducedMotion}
            intensity={effectiveIntensity}
            focusMode={config.focusMode}
            onError={handlePixiError}
          />
        </RuntimeBoundary>
      ) : useLayered ? (
        <RuntimeBoundary fallback={svgFallback} resetKey={`layered:${manifest.id}`}>
          <LayeredMascotRenderer
            state={state}
            poseInput={poseInput}
            reducedMotion={reducedMotion}
            intensity={effectiveIntensity}
            focusMode={config.focusMode}
            lipSyncEnabled={config.lipSyncEnabled}
            triggerEvent={triggerEvent}
          />
        </RuntimeBoundary>
      ) : (
        svgFallback
      )}
      <div className="state-line">
        <span className="state-dot" data-avatar-state={state} aria-hidden="true" />
        <span>{state}</span>
      </div>
    </section>
  );
}

function safeSupportsWebGL2(): boolean {
  try {
    return supportsWebGL2();
  } catch {
    return false;
  }
}
