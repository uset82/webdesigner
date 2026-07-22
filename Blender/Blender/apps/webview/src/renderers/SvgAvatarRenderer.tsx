import { useState, type CSSProperties } from "react";
import type { AvatarManifest, AvatarPoseInput, AvatarState } from "../bridge/messages";

type SvgAvatarRendererProps = {
  state: AvatarState;
  poseInput: AvatarPoseInput;
  reducedMotion: boolean;
  intensity: "low" | "medium" | "high";
  focusMode: boolean;
  lipSyncEnabled: boolean;
  assetUri?: string | undefined;
};

type AvatarCssProperties = CSSProperties & {
  "--look-x": string;
  "--look-y": string;
  "--mouth-open-scale": string;
};

export function SvgAvatarRenderer({
  state,
  poseInput,
  reducedMotion,
  intensity,
  focusMode,
  lipSyncEnabled,
  assetUri
}: SvgAvatarRendererProps) {
  const normalizedAssetUri = normalizeAssetUri(assetUri);
  const [loadedAssetUri, setLoadedAssetUri] = useState<string | null>(null);
  const [failedAssetUri, setFailedAssetUri] = useState<string | null>(null);
  const shouldAttemptAsset = shouldAttemptManifestSvg(normalizedAssetUri, failedAssetUri);
  const manifestAssetLoaded = shouldAttemptAsset && loadedAssetUri === normalizedAssetUri;
  const showBuiltIn = shouldShowBuiltInSvg(normalizedAssetUri, loadedAssetUri, failedAssetUri);
  const lookX = (((poseInput.cursorX ?? 0.5) - 0.5) * 5).toFixed(2);
  const lookY = (((poseInput.cursorY ?? 0.5) - 0.5) * 4).toFixed(2);
  const mouthScale = (0.65 + (lipSyncEnabled ? (poseInput.mouthOpen ?? 0) : 0) * 0.9).toFixed(2);
  const style: AvatarCssProperties = {
    "--look-x": `${lookX}px`,
    "--look-y": `${lookY}px`,
    "--mouth-open-scale": mouthScale
  };

  return (
    <div
      className="avatar-shell"
      data-avatar-state={state}
      data-reduced-motion={String(reducedMotion)}
      data-intensity={intensity}
      data-focus-mode={String(focusMode)}
      data-avatar-source={manifestAssetLoaded ? "manifest" : "builtin"}
      style={style}
      aria-hidden="true"
    >
      {showBuiltIn ? <BuiltInOrb /> : null}
      {shouldAttemptAsset && normalizedAssetUri ? (
        <img
          key={normalizedAssetUri}
          className="avatar-svg avatar-svg-asset"
          src={normalizedAssetUri}
          alt=""
          draggable={false}
          data-loaded={String(manifestAssetLoaded)}
          onLoad={() => {
            setLoadedAssetUri(normalizedAssetUri);
            setFailedAssetUri(null);
          }}
          onError={() => setFailedAssetUri(normalizedAssetUri)}
        />
      ) : null}
      <span className="avatar-presence" aria-hidden="true" />
    </div>
  );
}

export function resolveManifestSvgUri(manifest: Pick<AvatarManifest, "entrypoints" | "assets">): string | undefined {
  return normalizeAssetUri(manifest.entrypoints.svg) ?? normalizeAssetUri(manifest.assets?.svg);
}

export function shouldAttemptManifestSvg(assetUri: string | undefined, failedAssetUri: string | null): boolean {
  return Boolean(assetUri && assetUri !== failedAssetUri);
}

export function shouldShowBuiltInSvg(
  assetUri: string | undefined,
  loadedAssetUri: string | null,
  failedAssetUri: string | null
): boolean {
  return !assetUri || failedAssetUri === assetUri || loadedAssetUri !== assetUri;
}

function normalizeAssetUri(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function BuiltInOrb() {
  return (
    <svg className="avatar-svg avatar-svg-builtin" viewBox="0 0 128 128" data-avatar-source="builtin">
      <title>Codex Avatar status</title>
      <defs>
        <linearGradient id="svg-runtime-body" x1="26" y1="20" x2="102" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5eead4" />
          <stop offset="0.52" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id="svg-runtime-face" cx="50%" cy="38%" r="70%">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbeafe" />
        </radialGradient>
      </defs>
      <g className="avatar-root" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          className="avatar-body"
          fill="url(#svg-runtime-body)"
          stroke="#111827"
          strokeWidth="4"
          d="M64 12c25 0 45 20 45 45 0 39-25 59-45 59S19 96 19 57c0-25 20-45 45-45Z"
        />
        <path
          className="avatar-face"
          fill="url(#svg-runtime-face)"
          stroke="#111827"
          strokeWidth="4"
          d="M36 58c0-16 12-28 28-28s28 12 28 28v19c0 16-12 28-28 28S36 93 36 77V58Z"
        />
        <g className="avatar-eyes">
          <path className="avatar-eye avatar-eye-left" stroke="#111827" strokeWidth="5" d="M51 66h.1" />
          <path className="avatar-eye avatar-eye-right" stroke="#111827" strokeWidth="5" d="M77 66h.1" />
          <path className="avatar-lid avatar-lid-left" stroke="#111827" strokeWidth="4" d="M46 66h10" />
          <path className="avatar-lid avatar-lid-right" stroke="#111827" strokeWidth="4" d="M72 66h10" />
        </g>
        <g className="avatar-mouth">
          <path className="avatar-mouth-closed" stroke="#111827" strokeWidth="4" d="M54 84c6 5 14 5 20 0" />
          <ellipse className="avatar-mouth-open" cx="64" cy="84" rx="8" ry="5" fill="#111827" stroke="none" />
        </g>
        <g className="avatar-antenna" stroke="#111827" strokeWidth="3">
          <path d="M29 50 16 42" />
          <path d="M99 50l13-8" />
          <path d="M64 20V7" />
          <circle cx="64" cy="7" r="4" fill="#f8fafc" />
        </g>
        <g className="avatar-effects" stroke="none">
          <circle className="avatar-thinking-dot dot-one" cx="26" cy="31" r="3" />
          <circle className="avatar-thinking-dot dot-two" cx="102" cy="31" r="3" />
          <path className="avatar-success-mark" d="M88 31 97 40 113 22" />
          <path className="avatar-warning-mark" d="M103 21v19M103 50h.1" />
        </g>
      </g>
    </svg>
  );
}
