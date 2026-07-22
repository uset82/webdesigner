import { Assets, type Texture } from "pixi.js";

export type TextureLoader = (source: string) => Promise<Texture>;
export type TextureDestroyer = (texture: Texture) => void;

export const DEFAULT_TEXTURE_CACHE_MAX_ENTRIES = 8;
export const DEFAULT_TEXTURE_CACHE_MAX_BYTES = 32 * 1024 * 1024;

export type TextureCacheOptions = {
  load?: TextureLoader | undefined;
  destroy?: TextureDestroyer | undefined;
  maxEntries?: number | undefined;
  maxBytes?: number | undefined;
};

type TextureEntry = {
  texture: Texture;
  bytes: number;
};

/**
 * Small, runtime-owned texture cache for local avatar assets.
 *
 * Loading is deduplicated by source and can be injected in tests or by a
 * future asset registry. The cache owns the loaded textures and destroys them
 * when removed, cleared, or disposed.
 */
export class PixiTextureCache {
  private readonly loadTexture: TextureLoader;
  private readonly destroyTexture: TextureDestroyer;
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly textures = new Map<string, TextureEntry>();
  private readonly pending = new Map<string, Promise<Texture>>();
  private generation = 0;
  private disposed = false;
  private totalBytes = 0;

  public constructor(options: TextureCacheOptions = {}) {
    this.loadTexture = options.load ?? ((source) => Assets.load<Texture>(source));
    this.destroyTexture = options.destroy ?? ((texture) => texture.destroy(true));
    this.maxEntries = validateLimit(options.maxEntries ?? DEFAULT_TEXTURE_CACHE_MAX_ENTRIES, "maxEntries");
    this.maxBytes = validateLimit(options.maxBytes ?? DEFAULT_TEXTURE_CACHE_MAX_BYTES, "maxBytes");
  }

  public async load(source: string): Promise<Texture> {
    const key = normalizeSource(source);
    if (this.disposed) throw new Error("Cannot load a texture after the cache has been disposed.");

    const cached = this.textures.get(key);
    if (cached) {
      this.touch(key, cached);
      return cached.texture;
    }

    const existing = this.pending.get(key);
    if (existing) return existing;

    const generation = this.generation;
    const loadPromise = Promise.resolve(this.loadTexture(key))
      .then((texture) => {
        if (this.disposed || generation !== this.generation) {
          this.destroyTexture(texture);
          throw new Error("Texture load completed after the cache was cleared.");
        }
        const bytes = estimateTextureBytes(texture);
        if (bytes > this.maxBytes) {
          this.destroyTexture(texture);
          throw new Error(`Texture exceeds the ${this.maxBytes}-byte cache limit.`);
        }
        const entry = { texture, bytes };
        this.textures.set(key, entry);
        this.totalBytes += bytes;
        this.touch(key, entry);
        this.evictIfNeeded();
        return texture;
      })
      .finally(() => {
        if (this.pending.get(key) === loadPromise) this.pending.delete(key);
      });

    this.pending.set(key, loadPromise);
    return loadPromise;
  }

  public get(source: string): Texture | undefined {
    const entry = this.textures.get(normalizeSource(source));
    if (!entry) return undefined;
    this.touch(normalizeSource(source), entry);
    return entry.texture;
  }

  public has(source: string): boolean {
    const key = normalizeSource(source);
    const entry = this.textures.get(key);
    if (!entry) return false;
    this.touch(key, entry);
    return true;
  }

  public delete(source: string): boolean {
    const key = normalizeSource(source);
    if (!this.textures.has(key)) return false;
    this.remove(key);
    return true;
  }

  public clear(): void {
    this.generation += 1;
    this.pending.clear();
    for (const entry of this.textures.values()) this.destroyTexture(entry.texture);
    this.textures.clear();
    this.totalBytes = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  public get size(): number {
    return this.textures.size;
  }

  public get estimatedBytes(): number {
    return this.totalBytes;
  }

  public get limits(): { maxEntries: number; maxBytes: number } {
    return { maxEntries: this.maxEntries, maxBytes: this.maxBytes };
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  private touch(key: string, entry: TextureEntry): void {
    this.textures.delete(key);
    this.textures.set(key, entry);
  }

  private evictIfNeeded(): void {
    while (this.textures.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestKey = this.textures.keys().next().value;
      if (!oldestKey) return;
      this.remove(oldestKey);
    }
  }

  private remove(key: string): void {
    const entry = this.textures.get(key);
    if (!entry) return;
    this.textures.delete(key);
    this.totalBytes -= entry.bytes;
    this.destroyTexture(entry.texture);
  }
}

function normalizeSource(source: string): string {
  const key = source.trim();
  if (key.length === 0) throw new Error("Texture source must not be empty.");
  return key;
}

function estimateTextureBytes(texture: Texture): number {
  const width = Number.isFinite(texture.width) ? Math.max(0, texture.width) : 0;
  const height = Number.isFinite(texture.height) ? Math.max(0, texture.height) : 0;
  return Math.ceil(width * height * 4);
}

function validateLimit(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Texture cache ${field} must be a positive integer.`);
  }
  return value;
}
