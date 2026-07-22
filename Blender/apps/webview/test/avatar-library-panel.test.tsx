import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AvatarLibraryState } from "../src/bridge/useExtensionBridge";
import { AssetManagerPanel } from "../src/components/AssetManagerPanel";

const readyLibrary: AvatarLibraryState = {
  loaded: true,
  workspaceAvailable: true,
  workspaceTrusted: true,
  activeId: "custom-avatar",
  avatars: [
    {
      id: "default-coder-orb",
      name: "Default Coder Orb",
      author: "Codex Avatar Studio contributors",
      license: "UNLICENSED",
      version: "1.0.0",
      runtime: "svg",
      active: false,
      builtIn: true,
      valid: true,
      errorCount: 0,
      warningCount: 0
    },
    {
      id: "custom-avatar",
      name: "Custom Avatar",
      author: "Local Artist",
      license: "Owned artwork",
      version: "1.2.0",
      runtime: "svg",
      active: true,
      builtIn: false,
      valid: true,
      errorCount: 0,
      warningCount: 1
    }
  ],
  status: {
    protocolVersion: 1,
    type: "library:status",
    operation: "validate",
    tone: "success",
    message: "Custom Avatar passed package validation with one note."
  },
  validation: {
    protocolVersion: 1,
    type: "library:validationResult",
    id: "custom-avatar",
    valid: true,
    errors: [],
    warnings: ["Optional preview image is not present."]
  }
};

describe("AssetManagerPanel", () => {
  it("renders a real active-avatar selector, readable metadata, actions, and structured validation", () => {
    const markup = renderToStaticMarkup(<AssetManagerPanel library={readyLibrary} />);

    expect(markup).toContain("Avatar library");
    expect(markup).toContain("Custom Avatar — Active");
    expect(markup).toContain("By Local Artist");
    expect(markup).toContain("Owned artwork");
    expect(markup).toContain("Active");
    expect(markup).toContain("Ready");
    expect(markup).toContain("1 note");
    expect(markup).toContain("Use Avatar");
    expect(markup).toContain("Validate");
    expect(markup).toContain("Reload Active");
    expect(markup).toContain("Open Folder");
    expect(markup).toContain("Export Avatar");
    expect(markup).toContain("Remove");
    expect(markup).toContain("Validation passed");
    expect(markup).toContain("Optional preview image is not present.");
    expect(markup).not.toMatch(/vscode-(?:resource|webview):|https?:\/\/|[A-Za-z]:\\/);
  });

  it("explains unavailable local actions and offers a setup action", () => {
    const markup = renderToStaticMarkup(
      <AssetManagerPanel
        library={{
          ...readyLibrary,
          workspaceAvailable: false,
          workspaceTrusted: false,
          status: null,
          validation: null
        }}
      />
    );

    expect(markup).toContain("Open a project folder");
    expect(markup).toContain("open a folder before managing your library");
    expect(markup).toMatch(/<button[^>]*>Open Folder<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Validate<\/button>/);
  });

  it("keeps destructive removal explicit and wired to typed library messages", async () => {
    const source = await readFile(new URL("../src/components/AssetManagerPanel.tsx", import.meta.url), "utf8");

    for (const operation of ["activate", "validate", "reload", "reveal", "export", "remove", "openWorkspace"]) {
      expect(source).toContain(`type: "library:${operation}"`);
    }
    expect(source).toContain("Confirm Remove");
    expect(source).toContain("This cannot be undone.");
  });
});
