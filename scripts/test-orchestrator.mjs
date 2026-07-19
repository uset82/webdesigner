import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { WebDesignerOrchestrator } = require("../dist/core/orchestrator.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function route(prompt, options = {}) {
  const orchestrator = new WebDesignerOrchestrator(root);
  const intent = orchestrator.intake("animation-test", "Animation test", prompt, options);
  return { intent, selection: orchestrator.selectStack(intent) };
}

test("animated web UI enables Animate UI", () => {
  const { intent, selection } = route("Build a product landing page with smooth animations and micro-interactions.");
  assert.equal(intent.constraints.requiresAnimatedUI, true);
  assert.deepEqual(selection.integrations, ["animate-ui"]);
  assert.equal(selection.frontendRuntime, "react-vite");
});

test("animated Next.js UI enables Animate UI", () => {
  const { selection } = route("Build an SEO-friendly Next.js site with animated UI transitions.");
  assert.deepEqual(selection.integrations, ["animate-ui"]);
  assert.equal(selection.frontendRuntime, "nextjs");
});

test("static UI and rendered video do not enable Animate UI", () => {
  const staticResult = route("Build a clean product landing page.");
  const videoResult = route("Create an animated video with Remotion and export an MP4.");
  assert.equal(staticResult.intent.constraints.requiresAnimatedUI, false);
  assert.deepEqual(staticResult.selection.integrations, []);
  assert.equal(videoResult.intent.constraints.requiresAnimatedUI, false);
  assert.deepEqual(videoResult.selection.integrations, []);
});

test("incompatible frontend records a fallback instead of enabling Animate UI", () => {
  const { selection } = route("Build a Flutter app with animated UI.", {
    experienceType: "cross-platform-mobile",
    requiresAnimatedUI: true
  });
  assert.deepEqual(selection.integrations, []);
  assert.match(selection.rationale.at(-1) || "", /incompatible with flutter/);
});
