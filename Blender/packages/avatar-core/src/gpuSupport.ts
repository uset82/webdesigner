import type { AvatarRuntime } from "./types.js";

export type DocumentWithCanvas = {
  createElement: (tagName: "canvas") => {
    getContext: (contextId: "webgl2") => unknown;
  };
};

export type NavigatorWithGpu = {
  gpu?: unknown;
};

export function supportsWebGL2(
  documentLike: DocumentWithCanvas | undefined = globalThis.document as DocumentWithCanvas
): boolean {
  if (!documentLike) {
    return false;
  }

  const canvas = documentLike.createElement("canvas");
  return Boolean(canvas.getContext("webgl2"));
}

export function supportsWebGPU(
  navigatorLike: NavigatorWithGpu | undefined = globalThis.navigator as NavigatorWithGpu
): boolean {
  return Boolean(navigatorLike?.gpu);
}

export function getPreferredGpuRuntime(
  options: { webgpuEnabled: boolean; documentLike?: DocumentWithCanvas; navigatorLike?: NavigatorWithGpu } = {
    webgpuEnabled: false
  }
): Extract<AvatarRuntime, "webgl" | "webgpu" | "svg"> {
  if (options.webgpuEnabled && supportsWebGPU(options.navigatorLike)) {
    return "webgpu";
  }

  if (supportsWebGL2(options.documentLike)) {
    return "webgl";
  }

  return "svg";
}
