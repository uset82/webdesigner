import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarManifest } from "@codex-avatar-studio/avatar-core";

const pixiState = vi.hoisted(() => ({
  applications: [] as Array<{
    canvas: object;
    destroy: ReturnType<typeof vi.fn>;
    initOptions: unknown;
    renderer: { resolution: number; resize: ReturnType<typeof vi.fn> };
    stage: { addChild: ReturnType<typeof vi.fn>; visible: boolean };
    ticker: {
      maxFPS: number;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  }>,
  nextInitError: null as Error | null,
  initDelayMs: 0,
  assetTexture: { source: {}, width: 128, height: 64, destroy: vi.fn() }
}));

vi.mock("pixi.js", () => {
  class MockApplication {
    public readonly canvas = {};
    public readonly stage = { addChild: vi.fn(), visible: true };
    public readonly renderer = { resolution: 1, resize: vi.fn() };
    public readonly ticker = { maxFPS: 0, start: vi.fn(), stop: vi.fn(), add: vi.fn(), remove: vi.fn() };
    public readonly destroy = vi.fn();
    public initOptions: unknown = undefined;

    public constructor() {
      pixiState.applications.push(this);
    }

    public async init(options: unknown): Promise<void> {
      this.initOptions = options;
      if (pixiState.initDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pixiState.initDelayMs));
      }
      if (pixiState.nextInitError) {
        const error = pixiState.nextInitError;
        pixiState.nextInitError = null;
        throw error;
      }
    }

    public destroyApplication(): void {
      this.destroy();
    }
  }

  class MockGraphics {
    public tint = 0;
    public readonly position = { set: vi.fn() };
    public readonly scale = { set: vi.fn() };
    public readonly circle = vi.fn(() => this);
    public readonly clear = vi.fn(() => this);
    public readonly fill = vi.fn(() => this);
  }

  class MockRectangle {
    public constructor(
      public readonly x: number,
      public readonly y: number,
      public readonly width: number,
      public readonly height: number
    ) {}
  }

  class MockTexture {
    public readonly source: object;
    public readonly width: number;
    public readonly height: number;
    public readonly destroy = vi.fn();

    public constructor(options: { source?: object; frame?: MockRectangle } = {}) {
      this.source = options.source ?? {};
      this.width = options.frame?.width ?? 128;
      this.height = options.frame?.height ?? 64;
    }
  }

  class MockSprite {
    public texture: MockTexture;
    public readonly position = { set: vi.fn() };
    public readonly scale = { set: vi.fn() };

    public constructor(options: { texture: MockTexture }) {
      this.texture = options.texture;
    }
  }

  return {
    Application: MockApplication,
    Assets: { load: vi.fn(async () => pixiState.assetTexture) },
    Graphics: MockGraphics,
    Rectangle: MockRectangle,
    Sprite: MockSprite,
    Texture: MockTexture
  };
});

import { PixiAvatarRuntime } from "../src/index.js";

const manifest = {
  schemaVersion: 1,
  id: "test-avatar",
  name: "Test Avatar",
  version: "0.1.0",
  author: "Tests",
  license: "MIT",
  preferredRuntime: "pixi",
  fallbackRuntime: "svg",
  entrypoints: { svg: "avatar.svg" },
  capabilities: ["state-animation"],
  states: { idle: "idle_loop" }
} as AvatarManifest;

let visibilityHandler: (() => void) | undefined;

function createContainer(clientWidth = 320, clientHeight = 180) {
  const pixiChildren: unknown[] = [];
  const replaceChildren = vi.fn((...nextChildren: unknown[]) => {
    pixiChildren.splice(0, pixiChildren.length, ...nextChildren);
  });

  return {
    clientWidth,
    clientHeight,
    pixiChildren,
    replaceChildren
  } as unknown as HTMLElement & { pixiChildren: unknown[] };
}

beforeEach(() => {
  pixiState.applications.length = 0;
  pixiState.nextInitError = null;
  pixiState.initDelayMs = 0;
  pixiState.assetTexture = { source: {}, width: 128, height: 64, destroy: vi.fn() };
  visibilityHandler = undefined;
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: (event: string, handler: unknown) => {
      if (event === "visibilitychange" && typeof handler === "function") {
        visibilityHandler = handler as () => void;
      }
    },
    removeEventListener: vi.fn()
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      public observe = vi.fn();
      public disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PixiAvatarRuntime lifecycle", () => {
  it("initializes one application and disposes its resources", async () => {
    const container = createContainer();
    const runtime = new PixiAvatarRuntime();

    await runtime.initialize(container, manifest);

    expect(pixiState.applications).toHaveLength(1);
    expect(container.replaceChildren).toHaveBeenCalledWith(pixiState.applications[0]?.canvas);
    expect(runtime.getDebugInfo()?.renderer).toBe("Object");
    expect(runtime.getDebugInfo()?.textureCount).toBe(0);
    expect(runtime.getDebugInfo()?.textureBytes).toBe(0);

    await runtime.dispose();

    expect(pixiState.applications[0]?.destroy).toHaveBeenCalledWith(true, {
      children: true,
      texture: false,
      textureSource: false
    });
    expect(container.replaceChildren).toHaveBeenLastCalledWith();
    expect(container.pixiChildren).toHaveLength(0);
  });

  it("disposes the old application before reinitializing", async () => {
    const container = createContainer();
    const runtime = new PixiAvatarRuntime();

    await runtime.initialize(container, manifest);
    await runtime.initialize(container, manifest);

    expect(pixiState.applications).toHaveLength(2);
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
    expect(pixiState.applications[1]?.destroy).not.toHaveBeenCalled();
    expect(container.pixiChildren).toHaveLength(1);
  });

  it("pauses and resumes rendering with visibility", async () => {
    const runtime = new PixiAvatarRuntime();
    await runtime.initialize(createContainer(), manifest);
    const application = pixiState.applications[0];

    runtime.setVisible(false);
    expect(application?.stage.visible).toBe(false);
    expect(application?.ticker.stop).toHaveBeenCalled();

    runtime.setVisible(true);
    expect(application?.stage.visible).toBe(true);
    expect(application?.ticker.start).toHaveBeenCalled();
  });

  it("pauses rendering when the document becomes hidden", async () => {
    const runtime = new PixiAvatarRuntime();
    await runtime.initialize(createContainer(), manifest);
    const application = pixiState.applications[0];
    const documentStub = document as unknown as { visibilityState: "hidden" | "visible" };

    documentStub.visibilityState = "hidden";
    visibilityHandler?.();

    expect(application?.stage.visible).toBe(false);
    expect(application?.ticker.stop).toHaveBeenCalled();
  });

  it("approximates gaze and draws effects without work in low-performance mode", async () => {
    const container = createContainer();
    const runtime = new PixiAvatarRuntime();
    await runtime.initialize(container, manifest);
    const application = pixiState.applications[0];
    const face = application?.stage.addChild.mock.calls[2]?.[0] as {
      position: { set: ReturnType<typeof vi.fn> };
    };
    const mouth = application?.stage.addChild.mock.calls[3]?.[0] as {
      scale: { set: ReturnType<typeof vi.fn> };
    };
    const effects = application?.stage.addChild.mock.calls[1]?.[0] as {
      circle: ReturnType<typeof vi.fn>;
    };

    runtime.setPoseInput({ cursorX: 1, cursorY: 0 });
    runtime.setSpeechLevel(1);
    runtime.setState("thinking");
    expect(face.position.set).toHaveBeenLastCalledWith(167, 85);
    expect(mouth.scale.set).toHaveBeenLastCalledWith(1, 1.55);
    expect(effects.circle).toHaveBeenCalledTimes(2);

    runtime.setState("success");
    expect(effects.circle).toHaveBeenCalledTimes(8);
    await runtime.dispose();

    const lowPerformance = new PixiAvatarRuntime({ lowPerformance: true });
    await lowPerformance.initialize(createContainer(), manifest);
    const lowApplication = pixiState.applications[1];
    const lowEffects = lowApplication?.stage.addChild.mock.calls[1]?.[0] as {
      circle: ReturnType<typeof vi.fn>;
    };
    lowPerformance.setState("success");
    expect(lowEffects.circle).not.toHaveBeenCalled();
    await lowPerformance.dispose();

    const particlesDisabled = new PixiAvatarRuntime({ particlesEnabled: false });
    await particlesDisabled.initialize(createContainer(), manifest);
    const disabledApplication = pixiState.applications[2];
    const disabledEffects = disabledApplication?.stage.addChild.mock.calls[1]?.[0] as {
      circle: ReturnType<typeof vi.fn>;
    };
    particlesDisabled.setState("success");
    expect(disabledEffects.circle).not.toHaveBeenCalled();
    await particlesDisabled.dispose();
  });

  it("tries WebGPU when WebGL initialization fails and WebGPU is available", async () => {
    vi.stubGlobal("navigator", { gpu: {} });
    pixiState.nextInitError = new Error("WebGL unavailable");
    const runtime = new PixiAvatarRuntime();

    await runtime.initialize(createContainer(), manifest);

    expect(pixiState.applications).toHaveLength(2);
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
    const fallbackApplication = pixiState.applications[1];
    if (!fallbackApplication) throw new Error("Expected a WebGPU fallback application.");
    expect((fallbackApplication.initOptions as { preference: string }).preference).toBe("webgpu");
  });

  it("cleans up a partially initialized application and rejects the failure", async () => {
    pixiState.nextInitError = new Error("WebGL unavailable");
    const runtime = new PixiAvatarRuntime();

    await expect(runtime.initialize(createContainer(), manifest)).rejects.toThrow("WebGL unavailable");
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
  });

  it("times out a stalled initialization and cleans up when it eventually resolves", async () => {
    pixiState.initDelayMs = 40;
    const runtime = new PixiAvatarRuntime({ initializeTimeoutMs: 5 });

    await expect(runtime.initialize(createContainer(), manifest)).rejects.toThrow("initialization timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
    expect(runtime.getDebugInfo()).toBeUndefined();
  });

  it("survives twenty open-close cycles without duplicate canvases or live applications", async () => {
    const runtime = new PixiAvatarRuntime();

    for (let index = 0; index < 20; index += 1) {
      const container = createContainer();
      await runtime.initialize(container, manifest);
      expect(container.pixiChildren).toHaveLength(1);
      await runtime.dispose();
      expect(container.pixiChildren).toHaveLength(0);
    }

    expect(pixiState.applications).toHaveLength(20);
    for (const application of pixiState.applications) expect(application.destroy).toHaveBeenCalled();
  });

  it("switches avatars twenty times while retaining only the active application", async () => {
    const runtime = new PixiAvatarRuntime();
    const containers = [];

    for (let index = 0; index < 20; index += 1) {
      const container = createContainer();
      containers.push(container);
      await runtime.initialize(container, { ...manifest, id: `avatar-${index}` });
      if (index > 0) expect(containers[index - 1]?.pixiChildren).toHaveLength(0);
      expect(container.pixiChildren).toHaveLength(1);
    }

    expect(pixiState.applications).toHaveLength(20);
    for (const application of pixiState.applications.slice(0, 19)) {
      expect(application.destroy).toHaveBeenCalled();
    }
    expect(pixiState.applications[19]?.destroy).not.toHaveBeenCalled();
    await runtime.dispose();
    expect(containers[19]?.pixiChildren).toHaveLength(0);
  });

  it("bounds oversized canvas dimensions and reports runtime memory diagnostics", async () => {
    const runtime = new PixiAvatarRuntime();
    const container = createContainer(5000, 6000);

    await runtime.initialize(container, manifest);

    expect(runtime.getDebugInfo()?.canvasWidth).toBe(2048);
    expect(runtime.getDebugInfo()?.canvasHeight).toBe(2048);
    expect(pixiState.applications[0]?.renderer.resize).toHaveBeenCalledWith(2048, 2048);
    await runtime.dispose();
  });

  it("loads the local spritesheet contract and advances clips on the ticker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              image: "placeholder-spritesheet.svg",
              frameWidth: 64,
              frameHeight: 64,
              clips: {
                idle_loop: { name: "idle_loop", frames: [0, 1], fps: 4, loop: true },
                talk_loop: { name: "talk_loop", frames: [1, 0], fps: 4, loop: true }
              }
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );
    const runtime = new PixiAvatarRuntime({ maxFps: 60 });
    const spritesheetManifest = {
      ...manifest,
      assets: { pixi: "https://avatar.test/spritesheet.json" }
    } as AvatarManifest;

    await runtime.initialize(createContainer(), spritesheetManifest);
    const application = pixiState.applications[0];
    const sprite = application?.stage.addChild.mock.calls[1]?.[0] as {
      texture: unknown;
    };
    const tickerHandler = application?.ticker.add.mock.calls[0]?.[0] as
      | ((ticker: { deltaMS: number }) => void)
      | undefined;

    expect(sprite).toBeDefined();
    expect(application?.ticker.add).toHaveBeenCalledTimes(1);
    expect(runtime.getDebugInfo()?.maxFps).toBe(60);
    tickerHandler?.({ deltaMS: 250 });
    expect(sprite.texture).toBeDefined();
    await runtime.dispose();
  });

  it("cleans up the renderer when spritesheet metadata is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, image: "missing.svg" }), { status: 200 }))
    );
    const container = createContainer();
    const runtime = new PixiAvatarRuntime();
    const spritesheetManifest = {
      ...manifest,
      assets: { pixi: "https://avatar.test/spritesheet.json" }
    } as AvatarManifest;

    await expect(runtime.initialize(container, spritesheetManifest)).rejects.toThrow(
      "Invalid PixiJS spritesheet metadata"
    );
    expect(pixiState.applications[0]?.destroy).toHaveBeenCalled();
    expect(container.pixiChildren).toHaveLength(0);
  });
});
