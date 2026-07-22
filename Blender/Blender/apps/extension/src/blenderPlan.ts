import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type BlenderExportMode = "svg" | "glb" | "png";

export type BlenderExportResult = {
  mode: BlenderExportMode;
  outputPath: string;
  manifestPath: string;
};

export type BlenderExportPlan = BlenderExportResult & {
  args: string[];
  label: string;
  scriptPath: string;
  stagedManifestPath: string;
  stagedOutputPath: string;
};

export type BlenderExportPlanOptions = {
  blendPath: string;
  workspaceRoot: string;
  assetWorkspace: string;
  extensionRoot: string;
  jobId?: string;
  modes: BlenderExportMode[];
  allowExternalInput?: boolean;
};

const blenderScripts: Record<BlenderExportMode, { script: string; suffix: string; label: string }> = {
  svg: { script: "export_svg.py", suffix: ".line-art.svg", label: "SVG line art" },
  glb: { script: "export_glb.py", suffix: ".webgl.glb", label: "GLB" },
  png: { script: "render_turntable.py", suffix: ".preview.png", label: "PNG preview" }
};

export function createBlenderExportPlans(options: BlenderExportPlanOptions): {
  outputDirectory: string;
  stagingDirectory: string;
  exports: BlenderExportPlan[];
} {
  assertValidModes(options.modes);

  const workspaceRoot = path.resolve(options.workspaceRoot);
  const blendPath = path.resolve(options.blendPath);
  if (!options.allowExternalInput && !isInsideDirectory(workspaceRoot, blendPath)) {
    throw new Error("Blender input file is outside the workspace.");
  }
  if (path.extname(blendPath).toLowerCase() !== ".blend") {
    throw new Error("Blender input must be a .blend file.");
  }

  if (!options.assetWorkspace.trim() || path.isAbsolute(options.assetWorkspace)) {
    throw new Error("Blender asset workspace must be a non-empty relative path.");
  }

  const assetRoot = path.resolve(workspaceRoot, options.assetWorkspace);
  const outputDirectory = path.resolve(assetRoot, "exports", "blender");
  if (!isInsideDirectory(workspaceRoot, assetRoot) || assetRoot === workspaceRoot) {
    throw new Error("Resolved Blender export directory is outside the workspace.");
  }

  const jobId = options.jobId ?? randomUUID();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(jobId)) {
    throw new Error("Blender job id contains unsupported characters.");
  }
  const stagingDirectory = path.resolve(assetRoot, "cache", "jobs", `blender-${jobId}`);
  if (!isInsideDirectory(assetRoot, stagingDirectory) || !isInsideDirectory(assetRoot, outputDirectory)) {
    throw new Error("Resolved Blender job path is outside the asset workspace.");
  }

  const baseName = findAvailableBaseName(
    outputDirectory,
    sanitizeBlenderBaseName(path.parse(blendPath).name),
    options.modes
  );
  const exports = options.modes.map((mode) => {
    const descriptor = blenderScripts[mode];
    const outputPath = path.join(outputDirectory, `${baseName}${descriptor.suffix}`);
    const manifestPath = path.join(outputDirectory, `${baseName}.${mode}.export-report.json`);
    const stagedOutputPath = path.join(stagingDirectory, `${baseName}${descriptor.suffix}`);
    const stagedManifestPath = path.join(stagingDirectory, `${baseName}.${mode}.export-report.json`);
    const scriptPath = resolveBlenderScriptPath(options.extensionRoot, descriptor.script);

    assertPlannedPath(outputDirectory, outputPath, "output");
    assertPlannedPath(outputDirectory, manifestPath, "manifest");
    assertPlannedPath(stagingDirectory, stagedOutputPath, "staged output");
    assertPlannedPath(stagingDirectory, stagedManifestPath, "staged manifest");

    return {
      mode,
      outputPath,
      manifestPath,
      stagedOutputPath,
      stagedManifestPath,
      scriptPath,
      label: descriptor.label,
      args: [
        "--disable-autoexec",
        "--background",
        "--python",
        scriptPath,
        "--",
        "--input",
        blendPath,
        "--output",
        stagedOutputPath,
        "--manifest",
        stagedManifestPath
      ]
    };
  });

  return { outputDirectory, stagingDirectory, exports };
}

export function sanitizeBlenderBaseName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "scene"
  );
}

export function resolveBlenderScriptPath(extensionRoot: string, scriptName: string): string {
  if (path.basename(scriptName) !== scriptName || path.extname(scriptName).toLowerCase() !== ".py") {
    throw new Error("Blender script name must be a local Python file name.");
  }
  const resolvedExtensionRoot = path.resolve(extensionRoot);
  const packagedScriptRoot = path.resolve(resolvedExtensionRoot, "media", "blender");
  const packagedScriptPath = path.resolve(packagedScriptRoot, scriptName);
  if (!isInsideDirectory(packagedScriptRoot, packagedScriptPath)) {
    throw new Error("Packaged Blender script path is outside the script directory.");
  }
  if (existsSync(packagedScriptPath)) {
    return packagedScriptPath;
  }

  const developmentScriptRoot = path.resolve(resolvedExtensionRoot, "..", "..", "scripts", "blender");
  const developmentScriptPath = path.resolve(developmentScriptRoot, scriptName);
  if (!isInsideDirectory(developmentScriptRoot, developmentScriptPath)) {
    throw new Error("Development Blender script path is outside the script directory.");
  }
  return developmentScriptPath;
}

export function isInsideDirectory(parent: string, child: string): boolean {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function assertValidModes(modes: BlenderExportMode[]): void {
  if (modes.length === 0) {
    throw new Error("Choose at least one Blender export mode.");
  }

  const uniqueModes = new Set<BlenderExportMode>();
  for (const mode of modes) {
    if (!Object.hasOwn(blenderScripts, mode)) {
      throw new Error(`Unsupported Blender export mode: ${String(mode)}`);
    }
    if (uniqueModes.has(mode)) {
      throw new Error(`Duplicate Blender export mode: ${mode}`);
    }
    uniqueModes.add(mode);
  }
}

function assertPlannedPath(parent: string, child: string, label: string): void {
  if (!isInsideDirectory(parent, child) || path.dirname(child) !== path.resolve(parent)) {
    throw new Error(`Resolved Blender ${label} path is outside its expected directory.`);
  }
}

function findAvailableBaseName(outputDirectory: string, requestedBaseName: string, modes: BlenderExportMode[]): string {
  for (let attempt = 1; attempt <= 10_000; attempt += 1) {
    const candidate = attempt === 1 ? requestedBaseName : `${requestedBaseName}-${attempt}`;
    const isAvailable = modes.every((mode) => {
      const descriptor = blenderScripts[mode];
      return (
        !existsSync(path.join(outputDirectory, `${candidate}${descriptor.suffix}`)) &&
        !existsSync(path.join(outputDirectory, `${candidate}.${mode}.export-report.json`))
      );
    });
    if (isAvailable) {
      return candidate;
    }
  }

  throw new Error("Could not allocate collision-safe Blender export filenames.");
}
