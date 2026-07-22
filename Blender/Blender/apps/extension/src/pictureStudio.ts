import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { copyFile, lstat, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertTraceableImageMetadata,
  MAX_TRACEABLE_IMAGE_BYTES,
  readImageMetadata,
  type ImageMetadata
} from "@codex-avatar-studio/asset-pipeline";

export const MAX_PICTURE_SOURCE_BYTES = MAX_TRACEABLE_IMAGE_BYTES;
const supportedPreviewExtensions = new Set([".png", ".jpg", ".jpeg"]);

export type PictureStudioErrorCode = "workspace-required" | "unsupported-format" | "invalid-image" | "preview-failed";

export type PicturePreviewJob = {
  jobId: string;
  cacheDirectory: string;
  previewPath: string;
  fileName: string;
  width: number;
  height: number;
  fileSize: number;
  format: "png" | "jpg";
  hasAlpha: boolean | null;
  sourceKind: "workspace" | "external";
  workspaceRoot: string;
};

export type PictureVectorPreview = {
  jobId: string;
  revision: number;
  previewPath: string;
};

export class PictureStudioError extends Error {
  public constructor(
    public readonly code: PictureStudioErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PictureStudioError";
  }
}

export class PictureStudioSession {
  private currentJob: PicturePreviewJob | undefined;
  private currentVectorPreview: PictureVectorPreview | undefined;

  public constructor(private readonly assetRootProvider: () => string | undefined) {}

  public getCurrentJob(): PicturePreviewJob | undefined {
    return this.currentJob;
  }

  public getVectorPreview(jobId: string, revision: number): PictureVectorPreview | undefined {
    const preview = this.currentVectorPreview;
    return preview?.jobId === jobId && preview.revision === revision ? preview : undefined;
  }

  public async preparePreview(
    inputPath: string,
    workspaceRoot: string,
    onProgress?: (stage: "validating" | "copying", jobId?: string) => void
  ): Promise<PicturePreviewJob> {
    const assetRoot = this.assetRootProvider();
    if (!assetRoot || !isInsideDirectory(workspaceRoot, assetRoot)) {
      throw new PictureStudioError("workspace-required", "Open a workspace folder before creating an avatar.");
    }

    onProgress?.("validating");
    const extension = path.extname(inputPath).toLowerCase();
    if (!supportedPreviewExtensions.has(extension)) {
      throw new PictureStudioError(
        "unsupported-format",
        "Choose a PNG, JPG, or JPEG picture. WebP will be enabled after packaged decoder verification."
      );
    }

    let sourceStat: Stats;
    try {
      sourceStat = await lstat(inputPath);
    } catch (error) {
      throw new PictureStudioError("invalid-image", `The selected picture is not readable: ${toErrorMessage(error)}`);
    }
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      throw new PictureStudioError("invalid-image", "Choose a regular local picture file, not a folder or shortcut.");
    }
    if (sourceStat.size <= 0 || sourceStat.size > MAX_PICTURE_SOURCE_BYTES) {
      throw new PictureStudioError(
        "invalid-image",
        `Picture size must be between 1 byte and ${MAX_PICTURE_SOURCE_BYTES / (1024 * 1024)} MiB.`
      );
    }

    let metadata: ImageMetadata;
    try {
      metadata = await readImageMetadata(inputPath);
      assertTraceableImageMetadata(metadata);
    } catch (error) {
      throw new PictureStudioError("invalid-image", toErrorMessage(error));
    }
    if (metadata.format === "webp") {
      throw new PictureStudioError("unsupported-format", "WebP preview is not enabled in the packaged Studio yet.");
    }

    const jobId = randomUUID();
    const cacheDirectory = path.resolve(assetRoot, "cache", "jobs", jobId);
    if (!isInsideDirectory(assetRoot, cacheDirectory)) {
      throw new PictureStudioError(
        "preview-failed",
        "Resolved picture preview directory is outside the asset workspace."
      );
    }
    const previewPath = path.join(cacheDirectory, `source${extension === ".jpeg" ? ".jpg" : extension}`);
    onProgress?.("copying", jobId);

    try {
      await mkdir(cacheDirectory, { recursive: true });
      await copyFile(inputPath, previewPath);
      if (this.currentJob) await rm(this.currentJob.cacheDirectory, { recursive: true, force: true });
    } catch (error) {
      await rm(cacheDirectory, { recursive: true, force: true }).catch(() => undefined);
      throw new PictureStudioError(
        "preview-failed",
        `Could not prepare the local picture preview: ${toErrorMessage(error)}`
      );
    }

    const job: PicturePreviewJob = {
      jobId,
      cacheDirectory,
      previewPath,
      fileName: path.basename(inputPath),
      width: metadata.width,
      height: metadata.height,
      fileSize: sourceStat.size,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha,
      sourceKind: isInsideDirectory(workspaceRoot, inputPath) ? "workspace" : "external",
      workspaceRoot
    };
    this.currentJob = job;
    this.currentVectorPreview = undefined;
    return job;
  }

  public async storeVectorPreview(jobId: string, revision: number, optimizedSvg: string): Promise<string> {
    const currentJob = this.currentJob;
    if (!currentJob || currentJob.jobId !== jobId) {
      throw new PictureStudioError("preview-failed", "The selected picture job is no longer available.");
    }
    if (!Number.isSafeInteger(revision) || revision < 1 || revision > 1_000_000) {
      throw new PictureStudioError("preview-failed", "The SVG preview revision is invalid.");
    }

    const vectorDirectory = path.resolve(currentJob.cacheDirectory, "vector");
    if (!isInsideDirectory(currentJob.cacheDirectory, vectorDirectory)) {
      throw new PictureStudioError("preview-failed", "Resolved SVG preview directory is outside the picture job.");
    }
    const previewPath = path.join(vectorDirectory, `optimized-${revision}.svg`);
    const temporaryPath = path.join(vectorDirectory, `.optimized-${revision}-${randomUUID()}.tmp`);

    await mkdir(vectorDirectory, { recursive: true });
    try {
      await writeFile(temporaryPath, optimizedSvg, { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, previewPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new PictureStudioError("preview-failed", `Could not prepare the SVG preview: ${toErrorMessage(error)}`);
    }

    const entries = await readdir(vectorDirectory);
    await Promise.all(
      entries
        .filter((entry) => entry !== path.basename(previewPath))
        .map((entry) => rm(path.join(vectorDirectory, entry), { force: true, recursive: true }))
    );
    this.currentVectorPreview = { jobId, revision, previewPath };
    return previewPath;
  }

  public async clearVectorPreview(jobId: string): Promise<boolean> {
    const currentJob = this.currentJob;
    if (!currentJob || currentJob.jobId !== jobId) return false;
    await rm(path.join(currentJob.cacheDirectory, "vector"), { recursive: true, force: true });
    if (this.currentVectorPreview?.jobId === jobId) this.currentVectorPreview = undefined;
    return true;
  }

  public async clear(jobId?: string): Promise<boolean> {
    const currentJob = this.currentJob;
    if (!currentJob || (jobId && currentJob.jobId !== jobId)) return false;

    await rm(currentJob.cacheDirectory, { recursive: true, force: true });
    if (this.currentJob?.jobId === currentJob.jobId) {
      this.currentJob = undefined;
      this.currentVectorPreview = undefined;
    }
    return true;
  }
}

function isInsideDirectory(parent: string, child: string): boolean {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
