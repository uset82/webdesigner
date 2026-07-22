import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { assertTraceableImageMetadata, readImageMetadata } from "../src/index.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAs2Pe9gAAAAASUVORK5CYII=",
  "base64"
);

test("reads PNG dimensions without invoking tracing", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-metadata-"));
  const inputPath = path.join(directory, "tiny.png");
  await writeFile(inputPath, tinyPng);

  const metadata = await readImageMetadata(inputPath);

  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 2);
  assert.equal(metadata.hasAlpha, false);
  assert.throws(() => assertTraceableImageMetadata(metadata), /too small/);
});
