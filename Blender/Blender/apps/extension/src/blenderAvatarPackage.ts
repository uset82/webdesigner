import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";
import type { AvatarManifest, GeneratedAvatarMetadata } from "@codex-avatar-studio/avatar-core";
import { AvatarPackageError, validateAvatarPackage } from "./avatarPackages.js";
import type { BlenderExportOutcome } from "./blenderRunner.js";

export async function stageBlenderSvgPackage(options: {
  assetRoot: string;
  sourceFileName: string;
  outcomes: BlenderExportOutcome[];
  metadata: GeneratedAvatarMetadata;
}): Promise<string> {
  const metadata = normalizeMetadata(options.metadata);
  const successful = options.outcomes.filter(
    (outcome): outcome is Extract<BlenderExportOutcome, { status: "success" }> => outcome.status === "success"
  );
  const svg = successful.find((outcome) => outcome.mode === "svg");
  if (!svg) throw new AvatarPackageError("A validated Blender SVG line-art export is required to create an avatar.");

  const stagingRoot = path.resolve(options.assetRoot, "cache", "blender-packages", randomUUID());
  assertInside(options.assetRoot, stagingRoot);
  const files = new Map<string, Buffer>();
  files.set("svg/avatar.svg", await readApprovedExport(options.assetRoot, svg.outputPath));
  const glb = successful.find((outcome) => outcome.mode === "glb");
  const png = successful.find((outcome) => outcome.mode === "png");
  if (glb) files.set("webgl/avatar.glb", await readApprovedExport(options.assetRoot, glb.outputPath));
  if (png) files.set("preview/avatar.png", await readApprovedExport(options.assetRoot, png.outputPath));

  const svgSource = files.get("svg/avatar.svg")?.toString("utf8") ?? "";
  if (!/<svg\b/i.test(svgSource) || sanitizeSvg(svgSource) !== svgSource) {
    throw new AvatarPackageError("The Blender SVG export is not safe package-ready SVG content.");
  }

  const sourceMetadata = Buffer.from(
    `${JSON.stringify(
      {
        sourceFile: path.basename(options.sourceFileName),
        collectionWorkflow: "Export collection preferred; Avatar fallback; Guides and Ignore excluded",
        includedExports: successful.map((outcome) => outcome.mode),
        runtimeNote: glb
          ? "Validated GLB is active through the optional WebGL runtime; package SVG remains the required fallback."
          : "SVG is active because this package has no validated GLB export."
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  files.set("metadata/source.json", sourceMetadata);

  try {
    for (const [relativePath, content] of files) {
      const destination = path.join(stagingRoot, ...relativePath.split("/"));
      assertInside(stagingRoot, destination);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content, { flag: "wx" });
    }

    const checksums = Object.fromEntries([...files].map(([relativePath, content]) => [relativePath, sha256(content)]));
    const manifest: AvatarManifest = {
      schemaVersion: 1,
      id: metadata.id,
      name: metadata.name,
      version: metadata.version,
      author: metadata.author,
      license: metadata.license,
      preferredRuntime: glb ? "webgl" : "svg",
      fallbackRuntime: "svg",
      entrypoints: {
        svg: "svg/avatar.svg",
        ...(glb ? { webgl: "webgl/avatar.glb" } : {})
      },
      assets: {
        svg: "svg/avatar.svg",
        ...(glb ? { webgl: "webgl/avatar.glb" } : {})
      },
      runtimePriority: glb ? ["webgl", "svg"] : ["svg"],
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
      ...(png ? { previewImage: "preview/avatar.png" } : { previewImage: "svg/avatar.svg" }),
      checksums
    };
    await writeFile(path.join(stagingRoot, "avatar.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    const validation = await validateAvatarPackage(stagingRoot);
    if (!validation.valid) {
      throw new AvatarPackageError(`Blender avatar package failed validation: ${validation.errors.join(" ")}`);
    }
    return stagingRoot;
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

async function readApprovedExport(assetRoot: string, filePath: string): Promise<Buffer> {
  assertInside(assetRoot, filePath);
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.size === 0) {
    throw new AvatarPackageError("Blender package inputs must be validated regular export files.");
  }
  return readFile(filePath);
}

function normalizeMetadata(metadata: GeneratedAvatarMetadata): GeneratedAvatarMetadata {
  const normalized = {
    id: metadata.id.trim().toLowerCase(),
    name: metadata.name.trim(),
    author: metadata.author.trim(),
    version: metadata.version.trim(),
    license: metadata.license.trim()
  };
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized.id)) throw new AvatarPackageError("Avatar id is invalid.");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized.version)) {
    throw new AvatarPackageError("Version must use semantic version form such as 1.0.0.");
  }
  for (const [field, value] of Object.entries(normalized)) {
    if (!value || value.length > 160) throw new AvatarPackageError(`${field} must contain 1-160 characters.`);
  }
  return normalized;
}

function assertInside(parent: string, child: string): void {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new AvatarPackageError("Blender package path escaped the avatar workspace.");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
