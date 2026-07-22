import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createBlenderSceneFromSvg } from "../dist/blenderHandoff.js";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));

test("creates a collision-safe Blender working scene from sanitized workspace SVG without modifying it", async () => {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-handoff-"));
  const svgPath = path.join(workspaceRoot, ".codex-avatar", "cache", "pictures", "optimized.svg");
  await mkdir(path.dirname(svgPath), { recursive: true });
  const original = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>\n';
  writeFileSync(svgPath, original);

  const result = await createBlenderSceneFromSvg({
    blenderPath: "fake-blender",
    svgPath,
    sourceName: "My Avatar.svg",
    workspaceRoot,
    assetWorkspace: ".codex-avatar",
    extensionRoot,
    outputChannel: createOutputChannelMock(),
    timeoutMs: 5000,
    processRunner: async (_command, args) => {
      const output = argumentValue(args, "--output");
      const report = argumentValue(args, "--manifest");
      writeFileSync(output, Buffer.from("BLENDER-v300fixture"));
      writeFileSync(
        report,
        `${JSON.stringify({ schemaVersion: 1, mode: "svg-handoff", sourceFile: path.basename(svgPath), outputFile: path.basename(output), collection: "Export", objectCount: 1, guidance: "Editable curves are not a rig." })}\n`
      );
      return { stdout: "", stderr: "" };
    }
  });

  assert.equal(path.basename(result.scenePath), "My-Avatar.working.blend");
  assert.equal(path.basename(result.reportPath), "My-Avatar.scene.export-report.json");
  assert.ok(existsSync(result.scenePath));
  assert.equal(readFileSync(svgPath, "utf8"), original);
});

test("rejects SVG handoff input outside the trusted avatar workspace", async () => {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), "codex-avatar-handoff-workspace-"));
  const svgPath = path.join(mkdtempSync(path.join(os.tmpdir(), "codex-avatar-handoff-external-")), "avatar.svg");
  writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await assert.rejects(
    () =>
      createBlenderSceneFromSvg({
        blenderPath: "fake-blender",
        svgPath,
        sourceName: "avatar.svg",
        workspaceRoot,
        assetWorkspace: ".codex-avatar",
        extensionRoot,
        outputChannel: createOutputChannelMock(),
        timeoutMs: 5000
      }),
    /inside the avatar workspace/
  );
});

function argumentValue(args, name) {
  const index = args.indexOf(name);
  assert.notEqual(index, -1);
  return args[index + 1];
}

function createOutputChannelMock() {
  return { append() {}, appendLine() {} };
}
