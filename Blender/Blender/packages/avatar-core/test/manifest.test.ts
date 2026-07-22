import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getLive2DStateBinding,
  mapLive2DPoseInput,
  resolveAvatarRuntime,
  validateAvatarManifest
} from "../src/index.js";

const validManifest = {
  schemaVersion: 1,
  version: "0.1.0",
  id: "default-coder-orb",
  name: "Default Coder Orb",
  author: "Codex Avatar Studio contributors",
  license: "UNLICENSED (original project work)",
  preferredRuntime: "pixi",
  fallbackRuntime: "svg",
  entrypoints: {
    svg: "avatars/svg/placeholder-avatar.svg",
    pixi: "avatars/pixi/default/avatar.json"
  },
  capabilities: ["state-animation", "one-shot-triggers", "reduced-motion"],
  states: {
    idle: "idle_loop",
    thinking: "think_loop",
    speaking: "talk_loop",
    success: "celebrate_once",
    error: "error_once"
  },
  triggers: {
    nod: "nod_once",
    celebrate: "celebrate_once"
  },
  runtimePriority: ["pixi", "svg"],
  assets: {
    svg: "avatars/svg/placeholder-avatar.svg",
    pixi: "avatars/pixi/default/avatar.json"
  }
};

test("validates the versioned avatar manifest and emits actionable warnings", () => {
  const result = validateAvatarManifest(validManifest);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.manifest?.id, "default-coder-orb");
  assert.equal(result.manifest?.preferredRuntime, "pixi");
  assert.equal(result.manifest?.states.idle, "idle_loop");
  assert.deepEqual(result.warnings, []);
});

test("rejects missing required fields and invalid mapping keys", () => {
  const result = validateAvatarManifest({
    schemaVersion: 1,
    version: "0.1.0",
    id: "",
    name: "Broken",
    author: "Unknown",
    license: "Unknown",
    preferredRuntime: "pixi",
    fallbackRuntime: "svg",
    entrypoints: { svg: "" },
    capabilities: ["state-animation"],
    states: { "not-a-state": "broken" }
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /id/);
  assert.match(result.errors.join("\n"), /entrypoints/);
  assert.match(result.errors.join("\n"), /State mapping keys/);
});

test("resolves preferred runtime with the declared SVG fallback", () => {
  const manifest = validateAvatarManifest(validManifest).manifest;
  assert.ok(manifest);

  assert.equal(resolveAvatarRuntime("pixi", manifest, { pixi: true }), "pixi");
  assert.equal(resolveAvatarRuntime("vrm", manifest, { vrm: true }), "pixi");
  assert.equal(resolveAvatarRuntime("pixi", manifest, { pixi: false }), "svg");
});

test("validates Live2D compatibility metadata without making it an MVP runtime", () => {
  const result = validateAvatarManifest({
    ...validManifest,
    preferredRuntime: "live2d",
    entrypoints: {
      svg: "avatars/svg/placeholder-avatar.svg",
      live2d: "avatars/live2d/default/model.model3.json"
    },
    assets: {
      svg: "avatars/svg/placeholder-avatar.svg",
      live2d: "avatars/live2d/default/model.model3.json"
    },
    live2d: {
      model3: "avatars/live2d/default/model.model3.json",
      parameters: {
        mouthOpen: "ParamMouthOpenY",
        angleX: "ParamAngleX",
        angleY: "ParamAngleY",
        breath: "ParamBreath"
      },
      motions: { speaking: "TalkLoop" },
      expressions: { success: "sparkle" }
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.manifest?.live2d?.model3, "avatars/live2d/default/model.model3.json");
  assert.equal(result.manifest?.live2d?.motions?.speaking, "TalkLoop");
  assert.equal(result.manifest?.live2d?.expressions?.success, "sparkle");
});

test("maps Live2D state and pose inputs to Cubism parameter IDs", () => {
  const live2d = {
    model3: "avatars/live2d/default/model.model3.json",
    motions: { speaking: "TalkLoop" },
    expressions: { speaking: "talking" }
  };

  assert.deepEqual(getLive2DStateBinding("speaking", live2d), {
    motion: "TalkLoop",
    expression: "talking"
  });

  const parameters = mapLive2DPoseInput({
    state: "speaking",
    poseInput: {
      cursorX: 1,
      cursorY: 0,
      mouthOpen: 1.4
    },
    elapsedSeconds: 0,
    live2d
  });

  assert.equal(parameters.ParamMouthOpenY, 1);
  assert.equal(parameters.ParamAngleX, 15);
  assert.equal(parameters.ParamAngleY, 10);
  assert.equal(parameters.ParamBreath, 0.5);
});
