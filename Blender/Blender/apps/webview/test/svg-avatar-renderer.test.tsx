import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AvatarState } from "../src/bridge/messages";
import {
  resolveManifestSvgUri,
  shouldAttemptManifestSvg,
  shouldShowBuiltInSvg,
  SvgAvatarRenderer
} from "../src/renderers/SvgAvatarRenderer";

const requiredWholeAvatarStates: AvatarState[] = [
  "idle",
  "thinking",
  "speaking",
  "success",
  "warning",
  "error",
  "sleeping"
];

describe("manifest SVG resolution", () => {
  it("prefers the primary SVG entrypoint and supports the compatibility asset field", () => {
    expect(
      resolveManifestSvgUri({
        entrypoints: { svg: "vscode-webview://avatar/entrypoint.svg" },
        assets: { svg: "vscode-webview://avatar/compatibility.svg" }
      })
    ).toBe("vscode-webview://avatar/entrypoint.svg");

    expect(
      resolveManifestSvgUri({
        entrypoints: {},
        assets: { svg: "  vscode-webview://avatar/compatibility.svg  " }
      })
    ).toBe("vscode-webview://avatar/compatibility.svg");
    expect(resolveManifestSvgUri({ entrypoints: {}, assets: {} })).toBeUndefined();
  });

  it("falls back after a failed URI and retries when a cache-revised URI arrives", () => {
    const failedUri = "vscode-webview://avatar/custom.svg?revision=1";
    const revisedUri = "vscode-webview://avatar/custom.svg?revision=2";

    expect(shouldAttemptManifestSvg(failedUri, null)).toBe(true);
    expect(shouldAttemptManifestSvg(failedUri, failedUri)).toBe(false);
    expect(shouldShowBuiltInSvg(failedUri, null, failedUri)).toBe(true);
    expect(shouldAttemptManifestSvg(revisedUri, failedUri)).toBe(true);
    expect(shouldShowBuiltInSvg(revisedUri, failedUri, failedUri)).toBe(true);
    expect(shouldShowBuiltInSvg(revisedUri, revisedUri, null)).toBe(false);
  });
});

describe("SvgAvatarRenderer", () => {
  it("attempts a custom flat SVG without requiring named internal layers", () => {
    const markup = renderAvatar("idle", "vscode-webview://avatar/flat.svg?revision=1");

    expect(markup).toContain('class="avatar-svg avatar-svg-asset"');
    expect(markup).toContain('src="vscode-webview://avatar/flat.svg?revision=1"');
    expect(markup).toContain('data-loaded="false"');
    expect(markup).toContain('class="avatar-svg avatar-svg-builtin"');
    expect(markup).not.toContain("<object");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("<embed");
  });

  it("renders only the built-in orb when the manifest has no SVG", () => {
    const markup = renderAvatar("idle");

    expect(markup).toContain('data-avatar-source="builtin"');
    expect(markup).toContain('class="avatar-svg avatar-svg-builtin"');
    expect(markup).not.toContain("<img");
  });

  it.each(requiredWholeAvatarStates)("keeps the generic whole-avatar state contract for %s", (state) => {
    const markup = renderAvatar(state, "vscode-webview://avatar/custom.svg?revision=3");

    expect(markup).toContain(`data-avatar-state="${state}"`);
    expect(markup).toContain('class="avatar-svg avatar-svg-asset"');
  });
});

function renderAvatar(state: AvatarState, assetUri?: string): string {
  return renderToStaticMarkup(
    <SvgAvatarRenderer
      state={state}
      poseInput={{}}
      reducedMotion={false}
      intensity="medium"
      focusMode={false}
      lipSyncEnabled={false}
      assetUri={assetUri}
    />
  );
}
