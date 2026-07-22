import assert from "node:assert/strict";
import { access, mkdtemp, open, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Jimp from "jimp";
import { test } from "vitest";
import { previewImageToSvg, savePreviewedImageToSvg, vectorizeImageToSvg } from "../src/index.js";

const traceablePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);

test("vectorizes an image into local raw SVG, optimized SVG, and manifest files", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-vectorize-"));
  const inputPath = path.join(workspaceRoot, "tiny-avatar.png");
  await writeFile(inputPath, traceablePng);

  const result = await vectorizeImageToSvg({
    inputPath,
    workspaceRoot,
    assetWorkspace: ".codex-avatar"
  });

  const rawSvg = await readFile(result.rawSvgPath, "utf8");
  const optimizedSvg = await readFile(result.optimizedSvgPath, "utf8");
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

  assert.match(rawSvg, /<svg/i);
  assert.match(optimizedSvg, /<svg/i);
  assert.equal(manifest.source.type, "image-trace");
  assert.equal(manifest.outputs.rawSvg, ".codex-avatar/exports/svg/tiny-avatar.raw-trace.svg");
  assert.equal(manifest.outputs.optimizedSvg, ".codex-avatar/exports/svg/tiny-avatar.optimized.svg");
});

test("previews without writing, then saves after confirmation", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-preview-"));
  const inputPath = path.join(workspaceRoot, "preview.png");
  await writeFile(inputPath, traceablePng);
  const sourceBefore = await readFile(inputPath);

  const preview = await previewImageToSvg({
    inputPath,
    workspaceRoot,
    preprocessing: { grayscale: true, threshold: 128, quantizationLevels: 2, removeBackground: true }
  });
  await assert.rejects(() => access(preview.optimizedSvgPath));
  assert.match(preview.optimizedSvg, /<svg/i);
  assert.ok(preview.optimizedValidation.byteLength > 0);
  assert.ok(preview.optimizedValidation.pathCount > 0);

  const result = await savePreviewedImageToSvg({ inputPath, workspaceRoot }, preview);
  assert.equal((await stat(result.optimizedSvgPath)).isFile(), true);
  assert.deepEqual(await readFile(inputPath), sourceBefore);
});

test("preserves color by default and traces transparent PNG plus baseline JPEG fixtures", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-color-fixtures-"));
  const colorPng = path.join(workspaceRoot, "color.png");
  const transparentPng = path.join(workspaceRoot, "transparent.png");
  const jpeg = path.join(workspaceRoot, "photo.jpg");

  const colorImage = await new Promise<Jimp>((resolve, reject) => {
    new Jimp(16, 16, 0xff0000ff, (error, image) => (error ? reject(error) : resolve(image)));
  });
  for (let y = 0; y < 16; y += 1) {
    for (let x = 8; x < 16; x += 1) colorImage.setPixelColor(0x0000ffff, x, y);
  }
  await colorImage.writeAsync(colorPng);
  await colorImage.quality(90).writeAsync(jpeg);

  const transparentImage = await new Promise<Jimp>((resolve, reject) => {
    new Jimp(16, 16, 0x00ff0080, (error, image) => (error ? reject(error) : resolve(image)));
  });
  await transparentImage.writeAsync(transparentPng);

  const colorPreview = await previewImageToSvg({ inputPath: colorPng, workspaceRoot });
  const transparentPreview = await previewImageToSvg({ inputPath: transparentPng, workspaceRoot });
  const jpegPreview = await previewImageToSvg({ inputPath: jpeg, workspaceRoot });

  assert.equal(hasNonGrayscaleColor(colorPreview.optimizedSvg), true, "default trace retains saturated source colors");
  assert.match(transparentPreview.optimizedSvg, /(?:fill-opacity|opacity)=/i);
  assert.match(jpegPreview.optimizedSvg, /<svg/i);
});

test("rejects WebP until a packaged decoder proves support", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-webp-fixture-"));
  const webp = path.join(workspaceRoot, "fixture.webp");
  await writeFile(webp, Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64"));
  await assert.rejects(() => previewImageToSvg({ inputPath: webp, workspaceRoot }), /Select PNG, JPG, or JPEG/);
});

test("uses deterministic collision-safe export names and never overwrites an existing trio member", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-collisions-"));
  const inputPath = path.join(workspaceRoot, "avatar.png");
  await writeFile(inputPath, traceablePng);

  const first = await vectorizeImageToSvg({ inputPath, workspaceRoot });
  const firstRaw = await readFile(first.rawSvgPath);
  const second = await vectorizeImageToSvg({ inputPath, workspaceRoot });
  assert.match(second.rawSvgPath, /avatar-2\.raw-trace\.svg$/);
  assert.deepEqual(await readFile(first.rawSvgPath), firstRaw);

  const preview = await previewImageToSvg({ inputPath, workspaceRoot, outputBaseName: "reserved" });
  const sentinel = Buffer.from("unrelated existing optimized SVG");
  await writeFile(preview.optimizedSvgPath, sentinel);
  await assert.rejects(() => savePreviewedImageToSvg({ inputPath, workspaceRoot }, preview), /EEXIST/);
  assert.deepEqual(await readFile(preview.optimizedSvgPath), sentinel);
  await assert.rejects(() => access(preview.rawSvgPath));
  await assert.rejects(() => access(preview.manifestPath));
});

test("enforces byte and path limits without committing output and strips appended malicious text", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-limits-"));
  const inputPath = path.join(workspaceRoot, "hostile.png");
  await writeFile(inputPath, Buffer.concat([traceablePng, Buffer.from('<script src="https://evil.example/x.js"/>')]));

  await assert.rejects(
    () => previewImageToSvg({ inputPath, workspaceRoot, maxSvgPaths: 0 }),
    /0-path complexity limit/
  );
  const preview = await previewImageToSvg({ inputPath, workspaceRoot });
  assert.doesNotMatch(preview.optimizedSvg, /script|evil\.example/i);
  await assert.rejects(() => access(preview.exportDirectory));
});

test("cancels before tracing and rejects oversized source dimensions", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-cancel-"));
  const inputPath = path.join(workspaceRoot, "cancel.png");
  const controller = new AbortController();
  controller.abort();
  await writeFile(inputPath, traceablePng);
  await assert.rejects(
    () => previewImageToSvg({ inputPath, workspaceRoot, signal: controller.signal }),
    (error: unknown) => error instanceof Error && error.name === "AbortError"
  );

  const oversized = path.join(workspaceRoot, "oversized.png");
  const header = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(header, 0);
  header.writeUInt32BE(5000, 16);
  header.writeUInt32BE(5000, 20);
  await writeFile(oversized, header);
  await assert.rejects(() => previewImageToSvg({ inputPath: oversized, workspaceRoot }), /too large.*safely/);

  const oversizedFile = path.join(workspaceRoot, "oversized-file.png");
  const handle = await open(oversizedFile, "w");
  await handle.truncate(32 * 1024 * 1024 + 1);
  await handle.close();
  await assert.rejects(() => previewImageToSvg({ inputPath: oversizedFile, workspaceRoot }), /32 MiB/);
});

function hasNonGrayscaleColor(svg: string): boolean {
  const colors = [...svg.matchAll(/(?:fill|stroke)=(?:"|')([^"']+)(?:"|')/gi)].map((match) => match[1] ?? "");
  return colors.some((color) => {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
    if (hex) {
      const expanded = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
      return expanded.slice(0, 2) !== expanded.slice(2, 4) || expanded.slice(2, 4) !== expanded.slice(4, 6);
    }
    const rgb = /^rgb\(\s*(\d+)\D+(\d+)\D+(\d+)\s*\)$/i.exec(color);
    return Boolean(rgb && (rgb[1] !== rgb[2] || rgb[2] !== rgb[3]));
  });
}
