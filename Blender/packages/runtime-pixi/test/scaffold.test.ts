import { expect, test } from "vitest";
import { PixiAvatarRuntime, runtimePixiPackageId, supportsWebGpu } from "../src/index.js";

test("exposes the optional Pixi runtime adapter contract", () => {
  expect(runtimePixiPackageId).toBe("@codex-avatar-studio/runtime-pixi");
  const runtime = new PixiAvatarRuntime();
  expect(runtime.kind).toBe("pixi");
  expect(runtime.capabilities.has("state-animation")).toBe(true);
  expect(typeof supportsWebGpu()).toBe("boolean");
});
