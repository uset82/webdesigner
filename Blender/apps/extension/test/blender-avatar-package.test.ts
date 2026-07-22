import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateAvatarPackage } from "../src/avatarPackages.js";
import { stageBlenderSvgPackage } from "../src/blenderAvatarPackage.js";
import type { BlenderExportOutcome } from "../src/blenderRunner.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("Blender SVG avatar packages", () => {
  it("activates a validated GLB with a required SVG fallback", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-blender-package-"));
    roots.push(root);
    const assetRoot = path.join(root, ".codex-avatar");
    const exportRoot = path.join(assetRoot, "exports", "blender");
    await mkdir(exportRoot, { recursive: true });
    const svgPath = path.join(exportRoot, "Mascot.line-art.svg");
    const glbPath = path.join(exportRoot, "Mascot.webgl.glb");
    const reportPath = path.join(exportRoot, "Mascot.svg.export-report.json");
    await writeFile(
      svgPath,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>\n'
    );
    await writeFile(glbPath, Buffer.from("glTF-export-only"));
    await writeFile(reportPath, "{}\n");
    const outcomes: BlenderExportOutcome[] = [
      { status: "success", mode: "svg", outputPath: svgPath, manifestPath: reportPath },
      {
        status: "success",
        mode: "glb",
        outputPath: glbPath,
        manifestPath: path.join(exportRoot, "Mascot.glb.export-report.json")
      }
    ];

    const stagedRoot = await stageBlenderSvgPackage({
      assetRoot,
      sourceFileName: "Mascot.blend",
      outcomes,
      metadata: { id: "mascot", name: "Mascot", author: "Local creator", version: "1.0.0", license: "UNLICENSED" }
    });
    const validation = await validateAvatarPackage(stagedRoot);
    expect(validation.valid).toBe(true);
    expect(validation.manifest?.preferredRuntime).toBe("webgl");
    expect(validation.manifest?.fallbackRuntime).toBe("svg");
    expect(validation.manifest?.entrypoints).toEqual({ svg: "svg/avatar.svg", webgl: "webgl/avatar.glb" });
    expect(validation.manifest?.assets?.webgl).toBe("webgl/avatar.glb");
    expect(validation.manifest?.runtimePriority).toEqual(["webgl", "svg"]);
    expect(await readFile(path.join(stagedRoot, "metadata", "source.json"), "utf8")).toContain("WebGL runtime");
  });

  it("requires a successful SVG export", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-blender-package-"));
    roots.push(root);
    await expect(
      stageBlenderSvgPackage({
        assetRoot: root,
        sourceFileName: "Mascot.blend",
        outcomes: [{ status: "failed", mode: "svg", message: "No Grease Pencil" }],
        metadata: { id: "mascot", name: "Mascot", author: "Local", version: "1.0.0", license: "UNLICENSED" }
      })
    ).rejects.toThrow(/SVG line-art export is required/);
  });
});
