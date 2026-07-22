import { Application, Graphics, Rectangle, Sprite, Texture, type Ticker } from "pixi.js";
import type {
  AvatarCapability,
  AvatarManifest,
  AvatarRuntimeAdapter,
  AvatarState,
  AvatarTrigger
} from "@codex-avatar-studio/avatar-core";
import { SpriteAnimationController } from "./animationController.js";
import {
  validateSpriteSheetManifest,
  validateSpriteSheetTextureDimensions,
  type SpriteSheetManifest
} from "./spritesheet.js";
export * from "./spritesheet.js";
export * from "./animationController.js";
export * from "./textureCache.js";
import { PixiTextureCache } from "./textureCache.js";

export const runtimePixiPackageId = "@codex-avatar-studio/runtime-pixi";
export const MAX_CANVAS_DIMENSION = 2048;
export const DEFAULT_RUNTIME_INITIALIZATION_TIMEOUT_MS = 10_000;

export type PixiRuntimeOptions = {
  maxFps?: 30 | 60;
  lowPerformance?: boolean;
  particlesEnabled?: boolean;
  reducedMotion?: boolean;
  initializeTimeoutMs?: number;
};

export type PixiRuntimeDebugInfo = {
  renderer: string;
  width: number;
  height: number;
  devicePixelRatio: number;
  maxFps: number;
  visible: boolean;
  state: AvatarState;
  canvasWidth: number;
  canvasHeight: number;
  textureCount: number;
  textureBytes: number;
};

export function supportsWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

const capabilities = new Set<AvatarCapability>(["state-animation", "one-shot-triggers", "reduced-motion", "particles"]);

/** Optional PixiJS v8 adapter. It never owns the fallback decision. */
export class PixiAvatarRuntime implements AvatarRuntimeAdapter {
  public readonly kind = "pixi" as const;
  public readonly capabilities = capabilities;
  private application: Application | undefined;
  private avatar: Graphics | undefined;
  private sprite: Sprite | undefined;
  private spriteFrames: Texture[] = [];
  private animationController: SpriteAnimationController | undefined;
  private animationElapsedMs = 0;
  private face: Graphics | undefined;
  private mouth: Graphics | undefined;
  private effects: Graphics | undefined;
  private container: HTMLElement | undefined;
  private observer: ResizeObserver | undefined;
  private visibilityHandler: (() => void) | undefined;
  private currentState: AvatarState = "idle";
  private readonly options: PixiRuntimeOptions;
  private lifecycleToken = 0;
  public readonly textureCache = new PixiTextureCache();
  private readonly animationTickerHandler = (ticker: Ticker): void => {
    this.advanceAnimation(ticker.deltaMS);
  };

  public constructor(options: PixiRuntimeOptions = {}) {
    this.options = options;
  }

  public async initialize(container: HTMLElement, manifest: AvatarManifest): Promise<void> {
    const timeoutMs = this.options.initializeTimeoutMs ?? DEFAULT_RUNTIME_INITIALIZATION_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("PixiJS initialization timeout must be a positive number.");
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.initializeInternal(container, manifest),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            void this.dispose();
            reject(new Error(`PixiJS initialization timed out after ${timeoutMs} ms.`));
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  private async initializeInternal(container: HTMLElement, manifest: AvatarManifest): Promise<void> {
    if (this.application) await this.dispose();
    const lifecycleToken = ++this.lifecycleToken;
    this.container = container;
    let application: Application;
    try {
      application = await initializePixiApplication(this.options);
    } catch (error) {
      if (lifecycleToken === this.lifecycleToken) this.container = undefined;
      throw error;
    }
    if (lifecycleToken !== this.lifecycleToken) {
      destroyApplication(application);
      return;
    }
    this.application = application;
    application.ticker.maxFPS = this.options.maxFps ?? 30;
    container.replaceChildren(application.canvas);
    this.avatar = new Graphics().circle(0, 0, 48).fill(0x60a5fa);
    this.face = createFaceGraphics();
    this.mouth = createMouthGraphics();
    this.effects = new Graphics();
    try {
      const spriteSheet = await loadSpriteSheet(manifest, this.textureCache);
      if (lifecycleToken !== this.lifecycleToken) {
        destroyApplication(application);
        return;
      }
      if (spriteSheet) {
        this.spriteFrames = createSpriteFrames(spriteSheet.texture, spriteSheet.manifest);
        const firstFrame = this.spriteFrames[0];
        if (!firstFrame) throw new Error("PixiJS spritesheet does not contain a frame 0.");
        this.sprite = new Sprite({ texture: firstFrame, anchor: 0.5 });
        this.animationController = new SpriteAnimationController(
          spriteSheet.manifest,
          this.options.lowPerformance === undefined ? {} : { lowPerformance: this.options.lowPerformance }
        );
        this.avatar.visible = false;
      }
    } catch (error) {
      if (lifecycleToken !== this.lifecycleToken) {
        destroyApplication(application);
        return;
      }
      await this.dispose();
      throw error;
    }
    application.stage.addChild(this.avatar);
    if (this.sprite) application.stage.addChild(this.sprite);
    application.stage.addChild(this.effects);
    application.stage.addChild(this.face);
    application.stage.addChild(this.mouth);
    this.sprite?.scale.set(1.5);
    if (this.animationController) {
      application.ticker.add?.(this.animationTickerHandler);
      this.applyAnimationFrame();
    }
    this.resize(container.clientWidth, container.clientHeight, getDevicePixelRatio());
    this.observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            this.resize(container.clientWidth, container.clientHeight, getDevicePixelRatio());
          });
    this.observer?.observe(container);
    this.visibilityHandler = () => this.setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.visibilityHandler();
    this.updateEffects();
  }

  public setState(state: AvatarState): void {
    this.currentState = state;
    if (this.animationController) {
      this.animationController.setState(state);
      this.animationElapsedMs = 0;
      this.applyAnimationFrame();
    }
    if (!this.avatar) return;
    const colors: Partial<Record<AvatarState, number>> = {
      idle: 0x60a5fa,
      thinking: 0xa78bfa,
      speaking: 0x5eead4,
      success: 0x3fb950,
      warning: 0xd29922,
      error: 0xf85149
    };
    this.avatar.tint = colors[state] ?? 0x60a5fa;
    this.updateEffects();
  }

  public trigger(trigger: AvatarTrigger): void {
    const animation = this.animationController?.trigger(trigger);
    if (animation) {
      this.animationElapsedMs = 0;
      this.applyAnimationFrame();
    }
    if (trigger === "show-particles") this.avatar?.scale.set(1.12);
    if (trigger === "clear-effects") this.avatar?.scale.set(1);
    if (trigger === "show-particles") this.drawParticles(this.currentState === "error" ? "error" : "success");
    if (trigger === "clear-effects") this.effects?.clear();
  }

  public setSpeechLevel(level: number): void {
    const normalized = Math.max(0, Math.min(1, level));
    this.avatar?.scale.set(1 + normalized * 0.12);
    this.mouth?.scale.set(1, 0.65 + normalized * 0.9);
  }

  public setPoseInput(input: { cursorX?: number | undefined; cursorY?: number | undefined }): void {
    if (!this.face || !this.container) return;
    const cursorX = clampUnit(input.cursorX ?? 0.5);
    const cursorY = clampUnit(input.cursorY ?? 0.5);
    const width = Math.min(Math.max(this.container.clientWidth, 1), MAX_CANVAS_DIMENSION);
    const height = Math.min(Math.max(this.container.clientHeight, 1), MAX_CANVAS_DIMENSION);
    const lookX = (cursorX - 0.5) * 14;
    const lookY = (cursorY - 0.5) * 10;
    this.face.position.set(width / 2 + lookX, height / 2 + lookY);
  }

  public setVisible(visible: boolean): void {
    if (!this.application) return;
    this.application.stage.visible = visible;
    if (visible) this.application.ticker.start();
    else this.application.ticker.stop();
  }

  public resize(width: number, height: number, devicePixelRatio: number): void {
    if (!this.application || !this.avatar) return;
    const boundedWidth = Math.min(Math.max(width, 1), MAX_CANVAS_DIMENSION);
    const boundedHeight = Math.min(Math.max(height, 1), MAX_CANVAS_DIMENSION);
    this.application.renderer.resolution = Math.min(Math.max(devicePixelRatio, 1), 2);
    this.application.renderer.resize?.(boundedWidth, boundedHeight);
    this.avatar.position.set(boundedWidth / 2, boundedHeight / 2);
    this.sprite?.position.set(boundedWidth / 2, boundedHeight / 2);
    this.effects?.position.set(boundedWidth / 2, boundedHeight / 2);
    this.mouth?.position.set(boundedWidth / 2, boundedHeight / 2);
    this.setPoseInput({});
  }

  public async dispose(): Promise<void> {
    this.lifecycleToken += 1;
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.visibilityHandler = undefined;
    this.application?.ticker.remove?.(this.animationTickerHandler);
    for (const frame of this.spriteFrames) frame.destroy(false);
    if (this.application) destroyApplication(this.application);
    this.textureCache.clear();
    this.application = undefined;
    this.avatar = undefined;
    this.sprite = undefined;
    this.spriteFrames = [];
    this.animationController = undefined;
    this.animationElapsedMs = 0;
    this.face = undefined;
    this.mouth = undefined;
    this.effects = undefined;
    this.container?.replaceChildren();
    this.container = undefined;
  }

  public getDebugInfo(): PixiRuntimeDebugInfo | undefined {
    if (!this.application || !this.container) return undefined;
    return {
      renderer: this.application.renderer.constructor.name,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      devicePixelRatio: this.application.renderer.resolution,
      maxFps: this.application.ticker.maxFPS,
      visible: this.application.stage.visible,
      state: this.currentState,
      canvasWidth: Math.min(Math.max(this.container.clientWidth, 1), MAX_CANVAS_DIMENSION),
      canvasHeight: Math.min(Math.max(this.container.clientHeight, 1), MAX_CANVAS_DIMENSION),
      textureCount: this.textureCache.size,
      textureBytes: this.textureCache.estimatedBytes
    };
  }

  private advanceAnimation(deltaMs: number): void {
    if (!this.animationController || !this.sprite) return;
    this.animationElapsedMs += Math.max(0, deltaMs);
    this.applyAnimationFrame();
    if (this.animationController.isComplete(this.animationElapsedMs)) {
      this.animationController.completeOneShot();
      this.animationElapsedMs = 0;
      this.applyAnimationFrame();
    }
  }

  private applyAnimationFrame(): void {
    if (!this.animationController || !this.sprite) return;
    const frame = this.spriteFrames[this.animationController.frameAt(this.animationElapsedMs)];
    if (frame) this.sprite.texture = frame;
  }

  private updateEffects(): void {
    if (!this.effects) return;
    this.effects.clear();
    this.effects.alpha = 1;
    if (this.options.reducedMotion) return;
    if (this.currentState === "thinking") {
      this.effects.alpha = 0.34;
      this.effects.circle(0, 0, 58).fill(0xa78bfa);
      this.effects.circle(0, 0, 68).fill(0x60a5fa);
    }
    if (
      this.options.particlesEnabled !== false &&
      !this.options.lowPerformance &&
      (this.currentState === "success" || this.currentState === "error")
    ) {
      this.drawParticles(this.currentState === "error" ? "error" : "success");
    }
  }

  private drawParticles(kind: "success" | "error"): void {
    if (
      !this.effects ||
      this.options.particlesEnabled === false ||
      this.options.lowPerformance ||
      this.options.reducedMotion
    ) {
      return;
    }
    const color = kind === "error" ? 0xf85149 : 0x3fb950;
    for (const [x, y, radius] of particlePositions) this.effects.circle(x, y, radius).fill(color);
  }
}

type LoadedSpriteSheet = {
  manifest: SpriteSheetManifest;
  texture: Texture;
};

async function loadSpriteSheet(
  manifest: AvatarManifest,
  textureCache: PixiTextureCache
): Promise<LoadedSpriteSheet | undefined> {
  const metadataUrl = manifest.assets?.pixi ?? manifest.entrypoints.pixi;
  if (!metadataUrl) return undefined;
  if (typeof fetch !== "function") throw new Error("PixiJS spritesheet loading requires fetch.");

  const response = await fetch(metadataUrl, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`PixiJS spritesheet metadata failed to load (${response.status}).`);
  const value: unknown = await response.json();
  const validation = validateSpriteSheetManifest(value);
  if (!validation.valid) throw new Error(`Invalid PixiJS spritesheet metadata: ${validation.errors.join(" ")}`);

  const sheetManifest = value as SpriteSheetManifest;
  const imageUrl = new URL(sheetManifest.image, metadataUrl).toString();
  const metadata = new URL(metadataUrl, imageUrl);
  const image = new URL(imageUrl);
  if (image.protocol !== metadata.protocol || image.origin !== metadata.origin) {
    throw new Error("PixiJS spritesheet image must be local to its metadata source.");
  }
  return { manifest: sheetManifest, texture: await textureCache.load(imageUrl) };
}

function createSpriteFrames(texture: Texture, manifest: SpriteSheetManifest): Texture[] {
  const dimensionValidation = validateSpriteSheetTextureDimensions(
    texture.width,
    texture.height,
    manifest.frameWidth,
    manifest.frameHeight
  );
  if (!dimensionValidation.valid) {
    throw new Error(`Invalid PixiJS spritesheet dimensions: ${dimensionValidation.errors.join(" ")}`);
  }
  const columns = Math.floor(texture.width / manifest.frameWidth);
  const rows = Math.floor(texture.height / manifest.frameHeight);

  const frameIndexes = new Set(Object.values(manifest.clips).flatMap((clip) => clip.frames));
  const frames: Texture[] = [];
  for (const frameIndex of frameIndexes) {
    const x = frameIndex % columns;
    const y = Math.floor(frameIndex / columns);
    if (y >= rows) throw new Error(`PixiJS spritesheet frame ${frameIndex} is outside the image bounds.`);
    frames[frameIndex] = new Texture({
      source: texture.source,
      frame: new Rectangle(x * manifest.frameWidth, y * manifest.frameHeight, manifest.frameWidth, manifest.frameHeight)
    });
  }
  return frames;
}

function optionsReducedMotion(options: PixiRuntimeOptions): boolean {
  return options.reducedMotion ?? false;
}

function getDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}

const particlePositions: readonly [number, number, number][] = [
  [-64, -34, 3],
  [-52, 42, 2],
  [58, -26, 2],
  [68, 28, 3],
  [-28, 62, 2],
  [32, 58, 2]
];

function createFaceGraphics(): Graphics {
  return new Graphics().circle(-12, -8, 4).fill(0x111827).circle(12, -8, 4).fill(0x111827);
}

function createMouthGraphics(): Graphics {
  return new Graphics().circle(0, 10, 4).fill(0x111827);
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

async function initializePixiApplication(options: PixiRuntimeOptions): Promise<Application> {
  const rendererOptions = {
    antialias: !optionsReducedMotion(options),
    backgroundAlpha: 0
  };
  const webglApplication = new Application();

  try {
    await webglApplication.init({ ...rendererOptions, preference: "webgl" });
    return webglApplication;
  } catch (webglError) {
    destroyApplication(webglApplication);
    if (!supportsWebGpu()) throw webglError;

    const webgpuApplication = new Application();
    try {
      await webgpuApplication.init({ ...rendererOptions, preference: "webgpu" });
      return webgpuApplication;
    } catch (webgpuError) {
      destroyApplication(webgpuApplication);
      throw new Error("PixiJS could not initialize WebGL or WebGPU.", { cause: webgpuError });
    }
  }
}

function destroyApplication(application: Application): void {
  try {
    application.destroy(true, { children: true, texture: false, textureSource: false });
  } catch {
    // Pixi can expose a partially initialized renderer after a failed init.
  }
}
