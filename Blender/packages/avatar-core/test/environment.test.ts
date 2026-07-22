import assert from "node:assert/strict";
import { test } from "vitest";
import { getPreferredGpuRuntime, shouldReduceMotion, supportsWebGL2, supportsWebGPU } from "../src/index.js";

test("reduced-motion helper supports explicit and system preferences", () => {
  assert.equal(shouldReduceMotion("always"), true);
  assert.equal(shouldReduceMotion("never"), false);
  assert.equal(
    shouldReduceMotion("system", {
      matchMedia: (query: string) => ({ matches: query.includes("reduce") })
    }),
    true
  );
});

test("GPU helpers are guarded when browser APIs are unavailable", () => {
  assert.equal(supportsWebGL2(undefined), false);
  assert.equal(supportsWebGPU(undefined), false);
  assert.equal(getPreferredGpuRuntime({ webgpuEnabled: true }), "svg");
});
