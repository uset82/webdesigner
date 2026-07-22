import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateAvatarPackage } from "../src/avatarPackages.js";
import { stageGeneratedSvgPackage } from "../src/generatedAvatarPackage.js";
import type { PicturePreviewJob, PictureVectorPreview } from "../src/pictureStudio.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("generated SVG avatar package", () => {
  it("stages a full schema-v1 package with source metadata and verified checksums", async () => {
    const fixture = await createFixture(
      '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#7c3aed" d="M0 0h16v16H0z"/></svg>'
    );
    const stagingRoot = await stageGeneratedSvgPackage({
      assetRoot: fixture.assetRoot,
      picture: fixture.picture,
      vector: fixture.vector,
      metadata: {
        id: "purple-avatar",
        name: "Purple Avatar",
        author: "Test Artist",
        version: "1.0.0",
        license: "Original artwork — all rights reserved"
      }
    });

    const validation = await validateAvatarPackage(stagingRoot);
    expect(validation.valid).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(stagingRoot, "avatar.manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      id: "purple-avatar",
      preferredRuntime: "svg",
      fallbackRuntime: "svg",
      entrypoints: { svg: "svg/avatar.svg" },
      previewImage: "svg/avatar.svg"
    });
    const svg = await readFile(path.join(stagingRoot, "svg", "avatar.svg"));
    const sourceMetadata = await readFile(path.join(stagingRoot, "metadata", "source.json"));
    expect(manifest.checksums["svg/avatar.svg"]).toBe(createHash("sha256").update(svg).digest("hex"));
    expect(manifest.checksums["metadata/source.json"]).toBe(createHash("sha256").update(sourceMetadata).digest("hex"));
    expect(JSON.parse(sourceMetadata.toString())).toMatchObject({
      sourceFileName: "portrait.png",
      width: 512,
      height: 768,
      format: "png",
      hasAlpha: true
    });
  });

  it("rejects unsafe cached SVG and removes the partial staging package", async () => {
    const fixture = await createFixture('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    await expect(
      stageGeneratedSvgPackage({
        assetRoot: fixture.assetRoot,
        picture: fixture.picture,
        vector: fixture.vector,
        metadata: {
          id: "unsafe-avatar",
          name: "Unsafe Avatar",
          author: "Test Artist",
          version: "1.0.0",
          license: "UNLICENSED"
        }
      })
    ).rejects.toThrow(/unsafe content/);
    await expect(access(path.join(fixture.picture.cacheDirectory, "package-staging"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});

async function createFixture(svg: string): Promise<{
  assetRoot: string;
  picture: PicturePreviewJob;
  vector: PictureVectorPreview;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-generated-package-"));
  tempRoots.push(root);
  const workspaceRoot = path.join(root, "workspace");
  const assetRoot = path.join(workspaceRoot, ".codex-avatar");
  const cacheDirectory = path.join(assetRoot, "cache", "jobs", "00000000-0000-4000-8000-000000000001");
  const previewPath = path.join(cacheDirectory, "source.png");
  const vectorPath = path.join(cacheDirectory, "vector", "optimized-1.svg");
  await mkdir(path.dirname(vectorPath), { recursive: true });
  await writeFile(previewPath, "source fixture");
  await writeFile(vectorPath, svg);
  return {
    assetRoot,
    picture: {
      jobId: "00000000-0000-4000-8000-000000000001",
      cacheDirectory,
      previewPath,
      fileName: "portrait.png",
      width: 512,
      height: 768,
      fileSize: 2048,
      format: "png",
      hasAlpha: true,
      sourceKind: "external",
      workspaceRoot
    },
    vector: {
      jobId: "00000000-0000-4000-8000-000000000001",
      revision: 1,
      previewPath: vectorPath
    }
  };
}
