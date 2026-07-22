import assert from "node:assert/strict";
import test from "node:test";
import {
  BLENDER_MCP_ADDON_COMMIT,
  BLENDER_MCP_ADDON_SHA256,
  BLENDER_MCP_VERSION,
  decideAddonInstall,
  parseArgs,
  sha256
} from "../../../scripts/setup-blender-mcp.mjs";

test("pins the audited Blender MCP server and add-on", () => {
  assert.equal(BLENDER_MCP_VERSION, "1.6.4");
  assert.equal(BLENDER_MCP_ADDON_COMMIT, "6641189231caf3752302ae20591bc87fda85fc4e");
  assert.equal(BLENDER_MCP_ADDON_SHA256.length, 64);
  assert.equal(sha256(Buffer.from("codex-avatar")), "4f5dc62c91650cfdd8966d5d65442ceadb9cc45824af02c2284aa68f53d888c7");
});

test("refuses an unexpected existing add-on unless replacement is explicit", () => {
  assert.equal(decideAddonInstall(undefined), "install");
  assert.equal(decideAddonInstall(BLENDER_MCP_ADDON_SHA256), "already-installed");
  assert.equal(decideAddonInstall("0".repeat(64)), "refuse-unexpected-existing-addon");
  assert.equal(decideAddonInstall("0".repeat(64), BLENDER_MCP_ADDON_SHA256, true), "replace");
});

test("parses setup verification options", () => {
  assert.deepEqual(parseArgs(["--blender", "C:/Blender/blender.exe", "--verify-only", "--replace"]), {
    blenderPath: "C:/Blender/blender.exe",
    replace: true,
    verifyOnly: true
  });
  assert.throws(() => parseArgs(["--remote-assets"]), /Unknown argument/);
});
