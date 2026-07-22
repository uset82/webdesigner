import assert from "node:assert/strict";
import path from "node:path";
import { test } from "vitest";
import {
  assertSupportedImagePath,
  createOutputPaths,
  getSvgExportDirectory,
  sanitizeFileBaseName
} from "../src/index.js";

test("validates supported image extensions", () => {
  assert.equal(assertSupportedImagePath("avatar.PNG"), ".png");
  assert.equal(assertSupportedImagePath("avatar.jpeg"), ".jpeg");
  assert.throws(() => assertSupportedImagePath("avatar.webp"), /Select PNG, JPG, or JPEG/);
  assert.throws(() => assertSupportedImagePath("avatar.gif"), /Unsupported image type/);
});

test("sanitizes output file names", () => {
  assert.equal(sanitizeFileBaseName("A tiny avatar!"), "A-tiny-avatar");
  assert.equal(sanitizeFileBaseName(""), "image");
});

test("keeps export directory inside workspace", () => {
  const workspaceRoot = path.resolve("workspace");
  const exportDirectory = getSvgExportDirectory(workspaceRoot);
  assert.ok(exportDirectory.endsWith(path.join(".codex-avatar", "exports", "svg")));

  assert.throws(() => getSvgExportDirectory(workspaceRoot, ".."), /outside the workspace/);
});

test("creates expected output path names", () => {
  const paths = createOutputPaths("My Avatar.png", path.resolve("exports"));
  assert.ok(paths.rawSvgPath.endsWith("My-Avatar.raw-trace.svg"));
  assert.ok(paths.optimizedSvgPath.endsWith("My-Avatar.optimized.svg"));
  assert.ok(paths.manifestPath.endsWith("My-Avatar.manifest.json"));
});
