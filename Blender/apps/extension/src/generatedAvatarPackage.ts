import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";
import type { AvatarManifest, GeneratedAvatarMetadata } from "@codex-avatar-studio/avatar-core";
import { AvatarPackageError, validateAvatarPackage } from "./avatarPackages.js";
import type { PicturePreviewJob, PictureVectorPreview } from "./pictureStudio.js";

export async function stageGeneratedSvgPackage(options: {
  assetRoot: string;
  picture: PicturePreviewJob;
  vector: PictureVectorPreview;
  metadata: GeneratedAvatarMetadata;
}): Promise<string> {
  const metadata = normalizeMetadata(options.metadata);
  if (options.vector.jobId !== options.picture.jobId) {
    throw new AvatarPackageError("The SVG preview does not belong to the selected picture job.");
  }
  if (!isPathInside(options.picture.cacheDirectory, options.vector.previewPath)) {
    throw new AvatarPackageError("The SVG preview is outside the disposable picture job.");
  }

  const stagingRoot = path.resolve(options.picture.cacheDirectory, "package-staging", randomUUID());
  if (!isPathInside(options.assetRoot, stagingRoot)) {
    throw new AvatarPackageError("Generated avatar staging path is outside the asset workspace.");
  }
  const svgRelativePath = "svg/avatar.svg";
  const sourceMetadataRelativePath = "metadata/source.json";
  const svgPath = path.join(stagingRoot, ...svgRelativePath.split("/"));
  const sourceMetadataPath = path.join(stagingRoot, ...sourceMetadataRelativePath.split("/"));

  try {
    const svg = await readFile(options.vector.previewPath, "utf8");
    if (!/<svg\b/i.test(svg) || sanitizeSvg(svg) !== svg) {
      throw new AvatarPackageError("Generated SVG preview is invalid or contains unsafe content.");
    }
    const sourceMetadata = `${JSON.stringify(
      {
        sourceFileName: path.basename(options.picture.fileName),
        width: options.picture.width,
        height: options.picture.height,
        format: options.picture.format,
        hasAlpha: options.picture.hasAlpha
      },
      null,
      2
    )}\n`;

    await mkdir(path.dirname(svgPath), { recursive: true });
    await mkdir(path.dirname(sourceMetadataPath), { recursive: true });
    await writeFile(svgPath, svg, { encoding: "utf8", flag: "wx" });
    await writeFile(sourceMetadataPath, sourceMetadata, { encoding: "utf8", flag: "wx" });

    const manifest: AvatarManifest = {
      schemaVersion: 1,
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      author: metadata.author,
      license: metadata.license,
      preferredRuntime: "svg",
      fallbackRuntime: "svg",
      entrypoints: { svg: svgRelativePath },
      assets: { svg: svgRelativePath },
      runtimePriority: ["svg"],
      capabilities: ["state-animation", "reduced-motion"],
      states: {
        idle: "idle",
        welcome: "welcome",
        listening: "listening",
        thinking: "thinking",
        speaking: "speaking",
        coding: "coding",
        reviewing: "reviewing",
        debugging: "debugging",
        building: "building",
        success: "success",
        warning: "warning",
        error: "error",
        sleeping: "sleeping"
      },
      previewImage: svgRelativePath,
      checksums: {
        [svgRelativePath]: sha256(svg),
        [sourceMetadataRelativePath]: sha256(sourceMetadata)
      }
    };
    await writeFile(path.join(stagingRoot, "avatar.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });

    const validation = await validateAvatarPackage(stagingRoot);
    if (!validation.valid) {
      throw new AvatarPackageError(
        `Generated avatar package failed validation: ${validation.errors.join(" ")}`,
        validation.errors
      );
    }
    return stagingRoot;
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

function normalizeMetadata(metadata: GeneratedAvatarMetadata): GeneratedAvatarMetadata {
  const normalized = {
    id: metadata.id.trim().toLowerCase(),
    name: metadata.name.trim(),
    author: metadata.author.trim(),
    version: metadata.version.trim(),
    license: metadata.license.trim()
  };
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized.id)) {
    throw new AvatarPackageError("Avatar id must use 1-80 lowercase letters, numbers, dots, underscores, or hyphens.");
  }
  for (const [field, value] of Object.entries(normalized)) {
    if (!value || value.length > 160) throw new AvatarPackageError(`${field} must contain 1-160 characters.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized.version)) {
    throw new AvatarPackageError("Version must use semantic version form such as 1.0.0.");
  }
  return normalized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
