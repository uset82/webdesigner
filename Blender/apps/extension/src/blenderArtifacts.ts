import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimizeSvg, sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";
import type { BlenderExportMode, BlenderExportResult } from "./blenderPlan.js";

const MAX_SVG_BYTES = 10 * 1024 * 1024;
const MAX_GLB_BYTES = 64 * 1024 * 1024;
const MAX_PNG_BYTES = 20 * 1024 * 1024;
const MAX_REPORT_BYTES = 64 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type BlenderExportReport = {
  schemaVersion: 1;
  mode: BlenderExportMode;
  sourceFile: string;
  outputFile: string;
  collection: string;
  objectCount: number;
  guidance: string;
};

export async function validateBlenderExportArtifacts(result: BlenderExportResult): Promise<BlenderExportReport> {
  const output = await readBoundedRegularFile(
    result.outputPath,
    `${result.mode} export output`,
    result.mode === "glb" ? MAX_GLB_BYTES : result.mode === "png" ? MAX_PNG_BYTES : MAX_SVG_BYTES
  );
  const reportBuffer = await readBoundedRegularFile(
    result.manifestPath,
    `${result.mode} export report`,
    MAX_REPORT_BYTES
  );

  if (result.mode === "svg") await validateAndNormalizeSvg(result.outputPath, output);
  if (result.mode === "glb") validateGlb(output);
  if (result.mode === "png") validatePng(output);
  return parseExportReport(reportBuffer.toString("utf8"), result);
}

async function validateAndNormalizeSvg(filePath: string, source: Buffer): Promise<void> {
  const svg = source.toString("utf8");
  if (!/<svg\b/i.test(svg)) throw new Error("Blender SVG output does not contain an SVG root element.");
  const optimized = optimizeSvg(svg);
  if (!/<svg\b/i.test(optimized) || sanitizeSvg(optimized) !== optimized) {
    throw new Error("Blender SVG output could not be converted to safe local SVG content.");
  }
  if (Buffer.byteLength(optimized, "utf8") > MAX_SVG_BYTES)
    throw new Error("Blender SVG output exceeds the safe size limit.");
  await writeFile(filePath, `${optimized}\n`, "utf8");
}

function validateGlb(buffer: Buffer): void {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("Blender GLB output has an invalid glTF binary header.");
  }
  if (buffer.readUInt32LE(4) !== 2) throw new Error("Blender GLB output must use glTF binary version 2.");
  if (buffer.readUInt32LE(8) !== buffer.length)
    throw new Error("Blender GLB output declares an incorrect file length.");
  const jsonLength = buffer.readUInt32LE(12);
  if (jsonLength <= 0 || 20 + jsonLength > buffer.length || buffer.toString("ascii", 16, 20) !== "JSON") {
    throw new Error("Blender GLB output is missing its JSON document chunk.");
  }
  try {
    JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trimEnd());
  } catch {
    throw new Error("Blender GLB output contains an invalid JSON document chunk.");
  }
}

function validatePng(buffer: Buffer): void {
  if (
    buffer.length < 33 ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error("Blender PNG output has an invalid PNG signature or header.");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new Error("Blender PNG dimensions must be between 1 and 8192 pixels.");
  }
}

function parseExportReport(source: string, result: BlenderExportResult): BlenderExportReport {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Blender ${result.mode} export report is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Blender export report must be a JSON object.");
  const report = value as Partial<BlenderExportReport>;
  if (
    report.schemaVersion !== 1 ||
    report.mode !== result.mode ||
    !isPortableFileName(report.sourceFile) ||
    report.outputFile !== path.basename(result.outputPath) ||
    typeof report.collection !== "string" ||
    !report.collection.trim() ||
    !Number.isSafeInteger(report.objectCount) ||
    (report.objectCount as number) < 0 ||
    typeof report.guidance !== "string" ||
    !report.guidance.trim()
  ) {
    throw new Error(`Blender ${result.mode} export report has an unsupported or non-portable structure.`);
  }
  return report as BlenderExportReport;
}

function isPortableFileName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    path.basename(value) === value &&
    !path.posix.isAbsolute(value) &&
    !path.win32.isAbsolute(value) &&
    !/^[a-z][a-z\d+.-]*:/i.test(value)
  );
}

async function readBoundedRegularFile(filePath: string, label: string, maxBytes: number): Promise<Buffer> {
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.size === 0 || info.size > maxBytes) {
    throw new Error(`Expected Blender ${label} was not created as a safe nonempty file within ${maxBytes} bytes.`);
  }
  return readFile(filePath);
}
