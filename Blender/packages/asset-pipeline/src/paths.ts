import { access } from "node:fs/promises";
import path from "node:path";
import { supportedImageExtensions, type SupportedImageExtension } from "./types.js";

export function assertSupportedImagePath(inputPath: string): SupportedImageExtension {
  const extension = path.extname(inputPath).toLowerCase() as SupportedImageExtension;
  if (!supportedImageExtensions.includes(extension)) {
    throw new Error(`Unsupported image type "${extension || "(none)"}". Select PNG, JPG, or JPEG.`);
  }

  return extension;
}

export function getSvgExportDirectory(workspaceRoot: string, assetWorkspace = ".codex-avatar"): string {
  const root = path.resolve(workspaceRoot);
  const exportDirectory = path.resolve(root, assetWorkspace, "exports", "svg");

  if (!isInsideDirectory(root, exportDirectory)) {
    throw new Error("Resolved export directory is outside the workspace.");
  }

  return exportDirectory;
}

export function createOutputPaths(
  inputPath: string,
  exportDirectory: string,
  outputBaseName?: string
): {
  rawSvgPath: string;
  optimizedSvgPath: string;
  manifestPath: string;
  safeBaseName: string;
} {
  const safeBaseName = sanitizeFileBaseName(outputBaseName ?? path.parse(inputPath).name);

  return createOutputPathsForStem(exportDirectory, safeBaseName);
}

export async function createAvailableOutputPaths(
  inputPath: string,
  exportDirectory: string,
  outputBaseName?: string
): Promise<ReturnType<typeof createOutputPaths>> {
  const baseName = sanitizeFileBaseName(outputBaseName ?? path.parse(inputPath).name);

  for (let copy = 1; copy <= 10_000; copy += 1) {
    const stem = copy === 1 ? baseName : `${baseName}-${copy}`;
    const candidate = createOutputPathsForStem(exportDirectory, stem);
    const occupied = await Promise.all(
      [candidate.rawSvgPath, candidate.optimizedSvgPath, candidate.manifestPath].map(pathExists)
    );
    if (occupied.every((exists) => !exists)) return candidate;
  }

  throw new Error("Unable to reserve a collision-free SVG export name.");
}

function createOutputPathsForStem(exportDirectory: string, safeBaseName: string): ReturnType<typeof createOutputPaths> {
  return {
    rawSvgPath: path.join(exportDirectory, `${safeBaseName}.raw-trace.svg`),
    optimizedSvgPath: path.join(exportDirectory, `${safeBaseName}.optimized.svg`),
    manifestPath: path.join(exportDirectory, `${safeBaseName}.manifest.json`),
    safeBaseName
  };
}

export function sanitizeFileBaseName(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized || "image";
}

export function toWorkspaceRelativePath(workspaceRoot: string, targetPath: string): string {
  const relativePath = path.relative(path.resolve(workspaceRoot), path.resolve(targetPath));
  return relativePath.split(path.sep).join("/");
}

function isInsideDirectory(parent: string, child: string): boolean {
  const relativePath = path.relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
