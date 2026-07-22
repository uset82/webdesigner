import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PictureStudioState } from "../src/bridge/useExtensionBridge";
import { PictureStudioPanel, VectorWorkspace } from "../src/components/PictureStudioPanel";

describe("PictureStudioPanel", () => {
  it("shows typed progress without exposing a source path", () => {
    const markup = renderStudio({
      status: "working",
      selection: null,
      stage: "validating",
      message: "Checking picture safety and dimensions.",
      progress: 0.45,
      vectorization: { status: "idle", revision: 0 },
      packageSave: { status: "idle" }
    });

    expect(markup).toContain("Checking picture safety and dimensions.");
    expect(markup).toContain("<progress");
    expect(markup).toContain("Checking");
  });

  it("shows the safe preview URI and useful source metadata", () => {
    const markup = renderStudio({
      status: "preview",
      selection: {
        jobId: "00000000-0000-4000-8000-000000000001",
        previewUri: "vscode-webview://avatar/preview.png?job=1",
        fileName: "avatar.png",
        width: 512,
        height: 768,
        fileSize: 2048,
        format: "png",
        hasAlpha: true,
        sourceKind: "external"
      },
      vectorization: { status: "idle", revision: 0 },
      packageSave: { status: "idle" }
    });

    expect(markup).toContain("vscode-webview://avatar/preview.png?job=1");
    expect(markup).toContain("avatar.png");
    expect(markup).toContain("512");
    expect(markup).toContain("768");
    expect(markup).toContain("2.0 KiB");
    expect(markup).toContain("Transparency detected");
    expect(markup).toContain("Copied locally for preview");
    expect(markup).toContain("Continue");
    expect(markup).toContain("Cancel");
  });

  it("shows a recoverable structured error", () => {
    const markup = renderStudio({
      status: "error",
      selection: null,
      vectorization: { status: "idle", revision: 0 },
      packageSave: { status: "idle" },
      error: { code: "workspace-untrusted", message: "Trust this workspace first.", recoverable: true }
    });

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Trust this workspace");
    expect(markup).toContain("Try another picture");
  });

  it("renders a safe side-by-side SVG result with presets, metrics, and animation-layer guidance", () => {
    const selection = {
      jobId: "00000000-0000-4000-8000-000000000001",
      previewUri: "vscode-webview://avatar/source.png",
      fileName: "avatar.png",
      width: 512,
      height: 512,
      fileSize: 2048,
      format: "png" as const,
      hasAlpha: true,
      sourceKind: "external" as const
    };
    const markup = renderToStaticMarkup(
      <VectorWorkspace
        selection={selection}
        options={{
          preset: "color-illustration",
          grayscale: false,
          colorCount: 16,
          threshold: null,
          removeNearWhite: true,
          noiseReduction: 10,
          detail: "balanced"
        }}
        setOptions={() => undefined}
        vectorization={{
          status: "ready",
          revision: 1,
          preview: {
            protocolVersion: 1,
            type: "studio:vectorPreview",
            jobId: selection.jobId,
            revision: 1,
            previewUri: "vscode-webview://avatar/optimized.svg?revision=1",
            metrics: {
              rawByteSize: 4096,
              optimizedByteSize: 2048,
              pathCount: 42,
              groupCount: 0,
              tinyPathCount: 3,
              missingLayers: ["avatar/root", "avatar/head"],
              warnings: ["Static SVG trace; named layers are optional."]
            }
          }
        }}
        packageSave={{ status: "idle" }}
        onGenerate={() => undefined}
        onBack={() => undefined}
      />
    );

    expect(markup).toContain("Source");
    expect(markup).toContain("Optimized SVG");
    expect(markup).toContain("vscode-webview://avatar/optimized.svg?revision=1");
    expect(markup).toContain("Color Illustration");
    expect(markup).toContain("High-Contrast Silhouette");
    expect(markup).toContain("42");
    expect(markup).toContain("avatar/root");
    expect(markup).toContain("Update SVG Preview");
    expect(markup).toContain("Save as avatar");
    expect(markup).toContain("License / rights statement");
    expect(markup).toContain("Save &amp; Use");
    expect(markup).toContain("Create Blender Scene from SVG");
    expect(markup).toContain("not an automatic rig");
    expect(markup).not.toMatch(/dangerouslySetInnerHTML|<object|<embed|<iframe/i);
  });

  it("shows collision choices and a completed active-package handoff without raw paths", () => {
    const selection = {
      jobId: "00000000-0000-4000-8000-000000000001",
      previewUri: "vscode-webview://avatar/source.png",
      fileName: "avatar.png",
      width: 512,
      height: 512,
      fileSize: 2048,
      format: "png" as const,
      hasAlpha: true,
      sourceKind: "external" as const
    };
    const commonProps = {
      selection,
      options: {
        preset: "color-illustration" as const,
        grayscale: false,
        colorCount: 16 as const,
        threshold: null,
        removeNearWhite: true,
        noiseReduction: 10,
        detail: "balanced" as const
      },
      setOptions: () => undefined,
      vectorization: {
        status: "ready" as const,
        revision: 1,
        preview: {
          protocolVersion: 1 as const,
          type: "studio:vectorPreview" as const,
          jobId: selection.jobId,
          revision: 1,
          previewUri: "vscode-webview://avatar/optimized.svg",
          metrics: {
            rawByteSize: 100,
            optimizedByteSize: 80,
            pathCount: 2,
            groupCount: 0,
            tinyPathCount: 0,
            missingLayers: [],
            warnings: []
          }
        }
      },
      onGenerate: () => undefined,
      onBack: () => undefined
    };
    const collision = renderToStaticMarkup(
      <VectorWorkspace
        {...commonProps}
        packageSave={{ status: "collision", revision: 1, id: "avatar", suggestedCopyId: "avatar-2" }}
      />
    );
    expect(collision).toContain("already exists");
    expect(collision).toContain("Replace");
    expect(collision).toContain("Create Copy");

    const success = renderToStaticMarkup(
      <VectorWorkspace
        {...commonProps}
        packageSave={{
          status: "success",
          revision: 1,
          avatar: { id: "avatar", name: "Avatar", replacedExisting: false }
        }}
      />
    );
    expect(success).toContain("saved and active");
    expect(success).toContain("Open Folder");
    expect(success).toContain("Copy Path");
    expect(success).toContain("Create Blender Scene from SVG");
    expect(success).not.toMatch(/[A-Za-z]:\\|\.codex-avatar[\\/]/);
  });

  it("returns a completed SVG handoff to the normal Blender export flow", () => {
    const selection = {
      jobId: "00000000-0000-4000-8000-000000000001",
      previewUri: "vscode-webview://avatar/source.png",
      fileName: "avatar.png",
      width: 512,
      height: 512,
      fileSize: 2048,
      format: "png" as const,
      hasAlpha: true,
      sourceKind: "external" as const
    };
    const markup = renderToStaticMarkup(
      <VectorWorkspace
        selection={selection}
        options={{
          preset: "clean-icon",
          grayscale: false,
          colorCount: 8,
          threshold: null,
          removeNearWhite: true,
          noiseReduction: 30,
          detail: "balanced"
        }}
        setOptions={() => undefined}
        vectorization={{
          status: "ready",
          revision: 2,
          preview: {
            protocolVersion: 1,
            type: "studio:vectorPreview",
            jobId: selection.jobId,
            revision: 2,
            previewUri: "vscode-webview://avatar/optimized.svg",
            metrics: {
              rawByteSize: 100,
              optimizedByteSize: 80,
              pathCount: 2,
              groupCount: 0,
              tinyPathCount: 0,
              missingLayers: [],
              warnings: []
            }
          }
        }}
        packageSave={{ status: "idle" }}
        blenderHandoff={{
          protocolVersion: 1,
          type: "blender:handoffStatus",
          jobId: selection.jobId,
          revision: 2,
          tone: "success",
          message: "Editable Blender starting scene created. Curves are not an automatic rig or 3D character.",
          sceneFileName: "avatar.working.blend",
          reportFileName: "avatar.scene.export-report.json"
        }}
        onGenerate={() => undefined}
        onBack={() => undefined}
      />
    );
    expect(markup).toContain("avatar.working.blend");
    expect(markup).toContain("Open Scene Folder");
    expect(markup).toContain("Export Blender Scene");
  });
});

function renderStudio(studio: PictureStudioState): string {
  return renderToStaticMarkup(<PictureStudioPanel studio={studio} />);
}
