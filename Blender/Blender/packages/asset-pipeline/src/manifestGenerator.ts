import path from "node:path";
import type { AssetManifestEntry } from "./types.js";
import { sanitizeFileBaseName, toWorkspaceRelativePath } from "./paths.js";

export function createManifestEntry(options: {
  inputPath: string;
  workspaceRoot: string;
  rawSvgPath: string;
  optimizedSvgPath: string;
  warnings: string[];
}): AssetManifestEntry {
  const id = sanitizeFileBaseName(path.parse(options.inputPath).name);

  return {
    version: "0.1.0",
    id,
    name: id,
    source: {
      type: "image-trace",
      path: toWorkspaceRelativePath(options.workspaceRoot, options.inputPath)
    },
    outputs: {
      rawSvg: toWorkspaceRelativePath(options.workspaceRoot, options.rawSvgPath),
      optimizedSvg: toWorkspaceRelativePath(options.workspaceRoot, options.optimizedSvgPath)
    },
    guidance:
      "Image tracing is for references, icons, and silhouettes. Animated characters need clean layered vector art or a rigged runtime file.",
    warnings: options.warnings,
    createdAt: new Date().toISOString()
  };
}
