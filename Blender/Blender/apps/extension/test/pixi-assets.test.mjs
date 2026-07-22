import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));
const assetRoot = path.join(extensionRoot, "media", "avatars", "pixi");
const requiredClips = [
  "idle_loop",
  "greet_once",
  "listen_loop",
  "think_loop",
  "talk_loop",
  "type_loop",
  "inspect_loop",
  "debug_loop",
  "scan_loop",
  "celebrate_once",
  "concerned_loop",
  "error_once",
  "sleep_loop",
  "blink_once",
  "look_left_once",
  "look_right_once",
  "nod_once",
  "shake_once",
  "point_once",
  "talk_start",
  "talk_stop",
  "particles_success",
  "clear_effects"
];

test("original Pixi placeholder spritesheet matches its local metadata", async () => {
  const manifest = JSON.parse(await readFile(path.join(assetRoot, "placeholder-spritesheet.json"), "utf8"));
  const svg = await readFile(path.join(assetRoot, "placeholder-spritesheet.svg"), "utf8");

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.image, "placeholder-spritesheet.svg");
  assert.equal(manifest.frameWidth, 64);
  assert.equal(manifest.frameHeight, 64);
  assert.deepEqual(Object.keys(manifest.clips), requiredClips);
  assert.equal((svg.match(/^ {2}<use href="#orb-/gm) ?? []).length, 16);
  assert.equal(/<script/i.test(svg), false);
  assert.equal(/href\s*=\s*["'](?:https?|data):/i.test(svg), false);
});
