import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PictureStudioError, PictureStudioSession } from "../src/pictureStudio.js";

const traceablePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("PictureStudioSession", () => {
  it("copies an external source into disposable local preview storage without changing it", async () => {
    const root = await createTempRoot();
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const externalSource = path.join(root, "source-avatar.png");
    await mkdir(workspace, { recursive: true });
    await writeFile(externalSource, traceablePng);
    const sourceBefore = await readFile(externalSource);
    const stages: string[] = [];
    const session = new PictureStudioSession(() => assetRoot);

    const job = await session.preparePreview(externalSource, workspace, (stage) => stages.push(stage));

    expect(stages).toEqual(["validating", "copying"]);
    expect(job.sourceKind).toBe("external");
    expect(job.fileName).toBe("source-avatar.png");
    expect(job.width).toBe(16);
    expect(job.height).toBe(16);
    expect(job.format).toBe("png");
    expect(job.hasAlpha).toBe(false);
    expect(await readFile(job.previewPath)).toEqual(sourceBefore);
    expect(await readFile(externalSource)).toEqual(sourceBefore);

    expect(await session.clear(job.jobId)).toBe(true);
    await expect(stat(job.cacheDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("replaces an older preview only after the new workspace picture is ready", async () => {
    const root = await createTempRoot();
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const firstSource = path.join(workspace, "first.png");
    const secondSource = path.join(workspace, "second.jpg");
    await mkdir(workspace, { recursive: true });
    await writeFile(firstSource, traceablePng);
    await writeFile(secondSource, Buffer.from("not a jpeg"));
    const session = new PictureStudioSession(() => assetRoot);
    const firstJob = await session.preparePreview(firstSource, workspace);

    await expect(session.preparePreview(secondSource, workspace)).rejects.toBeInstanceOf(PictureStudioError);
    expect((await stat(firstJob.previewPath)).isFile()).toBe(true);

    const validSecondSource = path.join(workspace, "second.png");
    await writeFile(validSecondSource, traceablePng);
    const secondJob = await session.preparePreview(validSecondSource, workspace);
    expect(secondJob.sourceKind).toBe("workspace");
    await expect(stat(firstJob.cacheDirectory)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await stat(secondJob.previewPath)).isFile()).toBe(true);
  });

  it("keeps SVG previews inside the disposable job and replaces only an older vector revision", async () => {
    const root = await createTempRoot();
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    const source = path.join(workspace, "avatar.png");
    await mkdir(workspace, { recursive: true });
    await writeFile(source, traceablePng);
    const session = new PictureStudioSession(() => assetRoot);
    const job = await session.preparePreview(source, workspace);

    const first = await session.storeVectorPreview(job.jobId, 1, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const second = await session.storeVectorPreview(
      job.jobId,
      2,
      '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>'
    );

    expect(await readFile(second, "utf8")).toContain("<path");
    await expect(stat(first)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(job.previewPath)).toEqual(traceablePng);

    expect(await session.clearVectorPreview(job.jobId)).toBe(true);
    await expect(stat(path.dirname(second))).rejects.toMatchObject({ code: "ENOENT" });
    expect((await stat(job.previewPath)).isFile()).toBe(true);
  });

  it("rejects unsupported and undersized pictures without creating a current job", async () => {
    const root = await createTempRoot();
    const workspace = path.join(root, "workspace");
    const assetRoot = path.join(workspace, ".codex-avatar");
    await mkdir(workspace, { recursive: true });
    const unsupported = path.join(workspace, "avatar.webp");
    await writeFile(unsupported, "not webp");
    const session = new PictureStudioSession(() => assetRoot);

    await expect(session.preparePreview(unsupported, workspace)).rejects.toMatchObject({ code: "unsupported-format" });
    expect(session.getCurrentJob()).toBeUndefined();
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-picture-studio-"));
  tempRoots.push(root);
  return root;
}
