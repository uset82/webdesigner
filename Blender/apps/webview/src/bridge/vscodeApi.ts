import {
  createWebviewToExtensionMessage,
  isAvatarRuntime,
  type WebviewBootstrap,
  type WebviewToExtensionMessage,
  type WebviewToExtensionMessageInput
} from "./messages";

type VsCodeApi = {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
    __CODEX_AVATAR_BOOTSTRAP__?: WebviewBootstrap;
  }
}

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (!api && typeof window.acquireVsCodeApi === "function") {
    api = window.acquireVsCodeApi();
  }

  return api;
}

export function postToExtension(message: WebviewToExtensionMessageInput): void {
  getVsCodeApi()?.postMessage(createWebviewToExtensionMessage(message));
}

export function getBootstrap(): WebviewBootstrap {
  const previewRuntime = getLocalPreviewRuntime();

  return (
    window.__CODEX_AVATAR_BOOTSTRAP__ ?? {
      config: {
        enabled: true,
        runtime: previewRuntime,
        position: "activity-bar-view",
        character: "default",
        animationIntensity: "medium",
        frameRate: 30,
        particleEffects: true,
        soundEnabled: false,
        lipSyncEnabled: false,
        idleTimeout: 15,
        sleepTimeout: 300,
        debugOverlay: false,
        noAnimation: false,
        focusMode: false,
        showSpeechBubble: true,
        respectReducedMotion: true,
        blenderPath: "",
        assetWorkspace: ".codex-avatar"
      },
      placeholderAvatarUri: "",
      manifest: {
        schemaVersion: 1,
        version: "0.1.0",
        id: "default-coder-orb",
        name: "Default Coder Orb",
        author: "Codex Avatar Studio contributors",
        license: "UNLICENSED (original project work)",
        preferredRuntime: "svg",
        fallbackRuntime: "svg",
        entrypoints: {},
        capabilities: ["state-animation", "reduced-motion"],
        states: { idle: "idle_loop" },
        runtimePriority: ["svg"],
        assets: {},
        triggers: {}
      }
    }
  );
}

function getLocalPreviewRuntime(): WebviewBootstrap["config"]["runtime"] {
  const runtime = new URLSearchParams(window.location.search).get("runtime");
  return runtime && isAvatarRuntime(runtime) ? runtime : "svg";
}
