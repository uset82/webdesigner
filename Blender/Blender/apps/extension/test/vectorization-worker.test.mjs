import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runVectorizationWorker } from "../dist/vectorizationWorkerRunner.js";

const workerPath = fileURLToPath(new URL("../dist/vectorizeWorker.js", import.meta.url));
const traceablePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR42mP4TyJgoKMGQQl1PGhUw/DRMGgSHwDUb/F8/RCeSQAAAABJRU5ErkJggg==",
  "base64"
);

test("the real vectorization worker previews locally and can be terminated during tracing", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-vector-worker-"));
  const inputPath = path.join(workspaceRoot, "worker.png");
  await writeFile(inputPath, traceablePng);
  const sourceHash = sha256(await readFile(inputPath));
  const request = {
    inputPath,
    workspaceRoot,
    outputBaseName: "worker",
    preprocessing: {
      grayscale: false,
      quantizationLevels: 16,
      removeBackground: true,
      noiseReduction: 10,
      detail: "balanced"
    },
    maxSvgBytes: 1_000_000,
    maxSvgPaths: 20_000
  };

  try {
    const stages = [];
    const preview = await runVectorizationWorker(workerPath, request, new AbortController().signal, (stage) =>
      stages.push(stage)
    );
    assert.match(preview.optimizedSvg, /<svg/i);
    assert.ok(preview.optimizedValidation.pathCount > 0);
    assert.ok(stages.includes("tracing"));
    await assert.rejects(() => access(preview.exportDirectory));
    assert.equal(sha256(await readFile(inputPath)), sourceHash);

    const controller = new AbortController();
    const cancelled = runVectorizationWorker(workerPath, request, controller.signal, (stage) => {
      if (stage === "tracing") controller.abort();
    });
    await assert.rejects(cancelled, (error) => error instanceof Error && error.name === "AbortError");
    await assert.rejects(() => access(preview.exportDirectory));
    assert.equal(sha256(await readFile(inputPath)), sourceHash);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
