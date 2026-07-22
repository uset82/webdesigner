import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type BlenderStatus, type BlenderToolsState, reduceBlenderToolsState } from "../src/bridge/useExtensionBridge";
import { BlenderToolsPanel } from "../src/components/BlenderToolsPanel";

const readyStatus: BlenderStatus = {
  protocolVersion: 1,
  type: "blender:status",
  availability: "ready",
  busy: false,
  executablePath: "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe",
  source: "platform",
  version: { major: 4, minor: 5, patch: 3, label: "Blender 4.5.3 LTS" },
  support: "supported",
  capabilities: ["svg", "glb", "png"],
  configuredPathInvalid: false,
  message: "Blender 4.5.3 is ready."
};

describe("BlenderToolsPanel", () => {
  it("shows a supported local connection and its useful capabilities", () => {
    const markup = renderTools({
      status: readyStatus,
      operation: {
        protocolVersion: 1,
        type: "blender:operation",
        operation: "test",
        tone: "success",
        message: "Connection test passed."
      }
    });

    expect(markup).toContain("Blender Tools");
    expect(markup).toContain("Optional production tool");
    expect(markup).toContain("Picture-to-SVG avatars work without Blender");
    expect(markup).toContain("Connected");
    expect(markup).toContain("Blender 4.5.3 LTS");
    expect(markup).toContain("Supported");
    expect(markup).toContain("Installed application");
    expect(markup).toContain("C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe");
    expect(markup).toContain("SVG line art");
    expect(markup).toContain("GLB export");
    expect(markup).toContain("PNG preview");
    expect(markup).toContain("Browse");
    expect(markup).toContain("Auto-detect");
    expect(markup).toContain("Test Connection");
    expect(markup).toContain("Open Log");
    expect(markup).toContain("Open Output Folder");
    expect(markup).toContain("Connection test passed.");
  });

  it("turns a bad saved path into repairable setup guidance", () => {
    const markup = renderTools({
      status: {
        ...readyStatus,
        availability: "invalid",
        executablePath: null,
        source: null,
        version: null,
        support: "unknown",
        capabilities: [],
        configuredPathInvalid: true,
        message: "The saved Blender path is not valid."
      },
      operation: null
    });

    expect(markup).toContain("Needs setup");
    expect(markup).toContain("Saved Blender path needs attention");
    expect(markup).toContain("Browse to blender.exe");
    expect(markup).toContain("No executable selected");
    expect(markup).toContain("No export modes reported yet");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Test Connection<\/button>/);
    expect(markup).toMatch(/<button[^>]*>Auto-detect<\/button>/);
  });

  it("offers cancellation while a probe is working", () => {
    const markup = renderTools({
      status: { ...readyStatus, availability: "checking", busy: true, message: "Checking Blender identity." },
      operation: {
        protocolVersion: 1,
        type: "blender:operation",
        operation: "test",
        tone: "working",
        message: "Testing the selected Blender executable…"
      }
    });

    expect(markup).toContain("Checking");
    expect(markup).toContain("Testing the selected Blender executable…");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Browse<\/button>/);
    expect(markup).toMatch(/<button[^>]*>Cancel<\/button>/);
  });

  it("keeps setup visible when local tools are unavailable for the workspace", () => {
    const markup = renderToStaticMarkup(
      <BlenderToolsPanel
        tools={{ status: null, operation: null, exportResult: null, avatarSave: null }}
        unavailableReason="Open a project folder to use local avatar tools."
      />
    );

    expect(markup).toContain("Open a project folder");
    expect(markup).toMatch(/<button[^>]*>Open Folder<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Browse<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Open Output Folder<\/button>/);
    expect(markup).toMatch(/<button[^>]*>Open Log<\/button>/);
  });

  it("shows partial export results and enables SVG-first avatar creation", () => {
    const markup = renderTools({
      status: readyStatus,
      operation: null,
      exportResult: {
        protocolVersion: 1,
        type: "blender:exportResult",
        jobId: "663f5428-5342-48d2-91ba-3730fc77b412",
        sourceFile: "Mascot.blend",
        results: [
          {
            status: "success",
            mode: "svg",
            fileName: "Mascot.line-art.svg",
            reportFileName: "Mascot.svg.export-report.json"
          },
          { status: "failed", mode: "glb", message: "The scene has no exportable mesh." }
        ],
        canUseAsAvatar: true
      },
      avatarSave: null
    });

    expect(markup).toContain("Latest export");
    expect(markup).toContain("Mascot.line-art.svg");
    expect(markup).toContain("The scene has no exportable mesh.");
    expect(markup).toContain("Use SVG as Avatar");
    expect(markup).toContain("Export a validated GLB");
    expect(markup).toContain("Avatar details");
  });

  it("uses only typed Blender requests and a collapsible top-level entry point", async () => {
    const [panelSource, bridgeSource, avatarPanelSource] = await Promise.all([
      readFile(new URL("../src/components/BlenderToolsPanel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/bridge/useExtensionBridge.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/components/AvatarPanel.tsx", import.meta.url), "utf8")
    ]);

    for (const operation of [
      "refresh",
      "browse",
      "autoDetect",
      "test",
      "cancel",
      "openLog",
      "openOutput",
      "saveAvatar"
    ]) {
      expect(panelSource).toContain(`type: "blender:${operation}"`);
    }
    expect(bridgeSource).toContain('case "blender:status"');
    expect(bridgeSource).toContain('case "blender:operation"');
    expect(avatarPanelSource).toContain("aria-expanded={blenderToolsOpen}");
    expect(avatarPanelSource).toContain('aria-controls="blender-tools-panel"');
    expect(avatarPanelSource).not.toContain('type: "command:exportBlender"');
  });

  it("keeps operation and probe busy states in sync", () => {
    const working = reduceBlenderToolsState(
      { status: readyStatus, operation: null, exportResult: null, avatarSave: null },
      {
        protocolVersion: 1,
        type: "blender:operation",
        operation: "test",
        tone: "working",
        message: "Testing Blender."
      }
    );
    expect(working.status?.busy).toBe(true);
    expect(working.operation?.tone).toBe("working");

    const ready = reduceBlenderToolsState(working, readyStatus);
    expect(ready.status?.busy).toBe(false);
    expect(ready.operation).toBeNull();

    const completed = reduceBlenderToolsState(working, {
      protocolVersion: 1,
      type: "blender:operation",
      operation: "cancel",
      tone: "success",
      message: "Cancelled."
    });
    expect(completed.status?.busy).toBe(false);
    expect(completed.operation?.tone).toBe("success");
  });
});

function renderTools(tools: BlenderToolsState): string {
  return renderToStaticMarkup(
    <BlenderToolsPanel tools={{ exportResult: null, avatarSave: null, ...tools }} unavailableReason={null} />
  );
}
