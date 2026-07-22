import { describe, expect, it } from "vitest";
import {
  clipForState,
  clipForTrigger,
  MAX_SPRITESHEET_TEXTURE_DIMENSION,
  validateSpriteSheetManifest,
  validateSpriteSheetTextureDimensions,
  type SpriteSheetManifest
} from "../src/spritesheet.js";

const manifest: SpriteSheetManifest = {
  schemaVersion: 1,
  image: "avatar.png",
  frameWidth: 64,
  frameHeight: 64,
  clips: {
    idle_loop: { name: "idle_loop", frames: [0, 1], loop: true },
    error_once: { name: "error_once", frames: [2], loop: false },
    nod_once: { name: "nod_once", frames: [3], loop: false }
  }
};

describe("spritesheet metadata", () => {
  it("validates metadata and resolves state/trigger clips", () => {
    expect(validateSpriteSheetManifest(manifest).valid).toBe(true);
    expect(clipForState(manifest, "error").name).toBe("error_once");
    expect(clipForTrigger(manifest, "nod")?.name).toBe("nod_once");
  });

  it("falls back to idle and rejects malformed metadata", () => {
    expect(clipForState(manifest, "thinking").name).toBe("idle_loop");
    const result = validateSpriteSheetManifest({ ...manifest, frameWidth: 0, clips: { bad: { frames: [-1] } } });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it("rejects remote paths and oversized frame metadata", () => {
    const result = validateSpriteSheetManifest({
      ...manifest,
      image: "https://example.com/avatar.png",
      clips: { bad: { name: "bad", frames: [MAX_SPRITESHEET_TEXTURE_DIMENSION] } }
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/safe local relative path|bounded/);

    const dimensions = validateSpriteSheetTextureDimensions(MAX_SPRITESHEET_TEXTURE_DIMENSION + 1, 64, 64, 64);
    expect(dimensions.valid).toBe(false);
    expect(dimensions.errors.join(" ")).toMatch(/width/);
  });
});
