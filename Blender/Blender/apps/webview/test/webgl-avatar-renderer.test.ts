import type { AvatarManifest } from "@codex-avatar-studio/avatar-core";
import { describe, expect, it } from "vitest";
import { isOneShotState, resolveGlbAsset, resolveStateClipName } from "../src/renderers/WebGLAvatarRenderer";

const manifest: AvatarManifest = {
  schemaVersion: 1,
  id: "cholita-3d",
  name: "Cholita 3D",
  version: "1.0.0",
  author: "Local creator",
  license: "LOCAL-ONLY",
  preferredRuntime: "webgl",
  fallbackRuntime: "svg",
  entrypoints: { webgl: "vscode-webview://avatar/cholita.glb", svg: "vscode-webview://avatar/cholita.svg" },
  assets: { webgl: "legacy.glb", svg: "legacy.svg" },
  runtimePriority: ["webgl", "svg"],
  capabilities: ["state-animation", "one-shot-triggers", "speech-level", "reduced-motion", "gaze"],
  states: { idle: "idle_loop", success: "success_once" },
  triggers: { blink: "blink_once" }
};

describe("WebGL avatar manifest mapping", () => {
  it("loads the webview-safe entrypoint before legacy assets", () => {
    expect(resolveGlbAsset(manifest, "webgl")).toBe("vscode-webview://avatar/cholita.glb");
    expect(resolveGlbAsset(manifest, "webgpu")).toBe("vscode-webview://avatar/cholita.glb");
    expect(resolveGlbAsset({ ...manifest, entrypoints: { svg: "avatar.svg" }, assets: {} }, "webgl")).toBeNull();
  });

  it("uses manifest state clips without changing schema version", () => {
    expect(resolveStateClipName(manifest, "idle")).toBe("idle_loop");
    expect(resolveStateClipName(manifest, "success")).toBe("success_once");
    expect(resolveStateClipName(manifest, "thinking")).toBeNull();
  });

  it("treats semantic and explicitly named one-shots as non-looping", () => {
    expect(isOneShotState("success", "success_once")).toBe(true);
    expect(isOneShotState("idle", "greet_once")).toBe(true);
    expect(isOneShotState("thinking", "thinking_loop")).toBe(false);
  });
});
