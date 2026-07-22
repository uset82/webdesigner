import { describe, expect, it, vi } from "vitest";
import type { Texture } from "pixi.js";
import { PixiTextureCache } from "../src/textureCache.js";

function fakeTexture(id: string, width = 1, height = 1): Texture & { id: string; destroyed: boolean } {
  return {
    id,
    width,
    height,
    destroyed: false,
    destroy: vi.fn(function (this: { destroyed: boolean }) {
      this.destroyed = true;
    })
  } as unknown as Texture & { id: string; destroyed: boolean };
}

describe("PixiTextureCache", () => {
  it("deduplicates concurrent loads and reuses the cached texture", async () => {
    const texture = fakeTexture("avatar");
    const load = vi.fn(async () => texture);
    const cache = new PixiTextureCache({ load });

    const [first, second] = await Promise.all([cache.load(" avatar.png "), cache.load("avatar.png")]);

    expect(first).toBe(texture);
    expect(second).toBe(texture);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    expect(cache.get("avatar.png")).toBe(texture);
  });

  it("destroys textures when deleted, cleared, or disposed", async () => {
    const first = fakeTexture("first");
    const second = fakeTexture("second");
    const textures = [first, second];
    const cache = new PixiTextureCache({ load: async () => textures.shift() as Texture });

    await cache.load("first.png");
    expect(cache.delete("first.png")).toBe(true);
    expect(first.destroyed).toBe(true);

    await cache.load("second.png");
    cache.dispose();
    expect(second.destroyed).toBe(true);
    expect(cache.size).toBe(0);
    expect(cache.isDisposed).toBe(true);
  });

  it("does not repopulate after an in-flight load is cleared", async () => {
    let resolveLoad: ((texture: Texture) => void) | undefined;
    const texture = fakeTexture("late");
    const cache = new PixiTextureCache({
      load: () =>
        new Promise<Texture>((resolve) => {
          resolveLoad = resolve;
        })
    });

    const pending = cache.load("late.png");
    cache.clear();
    resolveLoad?.(texture);

    await expect(pending).rejects.toThrow("after the cache was cleared");
    expect(texture.destroyed).toBe(true);
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used texture when entry limits are reached", async () => {
    const first = fakeTexture("first", 2, 2);
    const second = fakeTexture("second", 2, 2);
    const third = fakeTexture("third", 2, 2);
    const textures = [first, second, third];
    const cache = new PixiTextureCache({
      maxEntries: 2,
      maxBytes: 64,
      load: async () => textures.shift() as Texture
    });

    await cache.load("first.png");
    await cache.load("second.png");
    expect(cache.get("first.png")).toBe(first);
    await cache.load("third.png");

    expect(second.destroyed).toBe(true);
    expect(first.destroyed).toBe(false);
    expect(cache.size).toBe(2);
    expect(cache.estimatedBytes).toBe(32);
  });

  it("rejects a texture that exceeds the byte budget", async () => {
    const oversized = fakeTexture("oversized", 3, 2);
    const cache = new PixiTextureCache({ maxBytes: 16, load: async () => oversized });

    await expect(cache.load("oversized.png")).rejects.toThrow("cache limit");
    expect(oversized.destroyed).toBe(true);
    expect(cache.size).toBe(0);
    expect(cache.estimatedBytes).toBe(0);
  });
});
