import { describe, expect, it } from "vitest";
import { SpriteAnimationController } from "../src/animationController.js";
import type { SpriteSheetManifest } from "../src/spritesheet.js";

const manifest: SpriteSheetManifest = {
  schemaVersion: 1,
  image: "avatar.png",
  frameWidth: 64,
  frameHeight: 64,
  clips: {
    idle_loop: { name: "idle_loop", frames: [0, 1], loop: true },
    idle_alt: { name: "idle_alt", frames: [2], loop: true },
    error_once: { name: "error_once", frames: [3], loop: false, priority: 5 },
    nod_once: { name: "nod_once", frames: [4], loop: false, priority: 1 },
    particles_success: { name: "particles_success", frames: [5], loop: false }
  }
};

describe("SpriteAnimationController", () => {
  it("restores state after a one-shot and reports completion", () => {
    const completed: string[] = [];
    const controller = new SpriteAnimationController(manifest, { onComplete: (clip) => completed.push(clip.name) });
    controller.setState("idle");
    expect(controller.trigger("nod")?.clip.name).toBe("nod_once");
    controller.completeOneShot();
    expect(completed).toEqual(["nod_once"]);
    expect(controller.snapshot().clip.name.startsWith("idle_")).toBe(true);
  });

  it("supports deterministic idle variation and low-performance suppression", () => {
    const controller = new SpriteAnimationController(manifest, { random: () => 0.75 });
    expect(controller.setState("idle").clip.name).toBe("idle_alt");
    const low = new SpriteAnimationController(manifest, { lowPerformance: true });
    expect(low.trigger("show-particles")).toBeUndefined();
  });
});
