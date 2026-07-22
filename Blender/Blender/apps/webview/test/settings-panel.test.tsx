import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AvatarConfig } from "../src/bridge/messages";
import { SettingsPanel } from "../src/components/SettingsPanel";

const config: AvatarConfig = {
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
  focusMode: true,
  showSpeechBubble: true,
  respectReducedMotion: true,
  blenderPath: "",
  assetWorkspace: ".codex-avatar"
};

describe("SettingsPanel", () => {
  it("keeps everyday behavior visible and technical controls collapsed", () => {
    const markup = renderToStaticMarkup(<SettingsPanel config={config} />);

    expect(markup).toContain("Behavior");
    expect(markup).toContain("<legend>Everyday behavior</legend>");
    expect(markup).toContain("Enabled");
    expect(markup).toContain("Focus mode");
    expect(markup).toContain("Intensity");
    expect(markup).toContain("Speech bubble");
    expect(markup).toContain("Reduced motion");

    expect(markup).toContain('<details class="advanced-settings">');
    expect(markup).toContain("Advanced behavior");
    expect(markup).toContain("Runtime, timing, effects, and diagnostics");
    expect(markup).toContain("PixiJS");
    expect(markup).toContain("60 FPS");
    expect(markup).toContain("Reset settings");
    expect(markup).not.toContain('<input type="text"');
    expect(markup).not.toMatch(/>Avatar</);
  });

  it("preserves every non-avatar setting update and reset message", async () => {
    const source = await readFile(new URL("../src/components/SettingsPanel.tsx", import.meta.url), "utf8");
    const settingKeys = [
      "enabled",
      "focusMode",
      "animationIntensity",
      "showSpeechBubble",
      "respectReducedMotion",
      "runtime",
      "position",
      "frameRate",
      "particleEffects",
      "soundEnabled",
      "lipSyncEnabled",
      "idleTimeout",
      "sleepTimeout",
      "noAnimation",
      "debugOverlay"
    ];

    for (const key of settingKeys) {
      expect(source).toMatch(new RegExp(`config:\\s*\\{\\s*${key}:`));
    }
    expect(source).toContain('type: "command:resetSettings"');
    expect(source).not.toMatch(/config:\s*\{\s*character:/);
  });
});
