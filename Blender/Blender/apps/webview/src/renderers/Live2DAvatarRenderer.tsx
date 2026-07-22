import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getLive2DModel3Path,
  getLive2DStateBinding,
  mapLive2DPoseInput,
  type AvatarManifest,
  type AvatarPoseInput,
  type AvatarState,
  type AvatarTrigger
} from "@codex-avatar-studio/avatar-core";

type Live2DAvatarRendererProps = {
  state: AvatarState;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  fallback: ReactNode;
};

type Live2DLoadOptions = {
  canvas: HTMLCanvasElement;
  model3: string;
};

type Live2DModelController = {
  setParameterValues?: (parameters: Record<string, number>) => void;
  setParameterValue?: (parameterId: string, value: number) => void;
  startMotion?: (motion: string) => void;
  setExpression?: (expression: string) => void;
  trigger?: (trigger: AvatarTrigger) => void;
  destroy?: () => void;
};

type Live2DRuntime = {
  loadModel: (options: Live2DLoadOptions) => Promise<Live2DModelController> | Live2DModelController;
};

declare global {
  interface Window {
    __CODEX_LIVE2D_RUNTIME__?: Live2DRuntime;
  }
}

export function Live2DAvatarRenderer({ state, poseInput, manifest, triggerEvent, fallback }: Live2DAvatarRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Live2DModelController | null>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const model3 = getLive2DModel3Path(manifest);
  const runtime = getLive2DRuntime();
  const stateBinding = useMemo(() => getLive2DStateBinding(state, manifest.live2d), [manifest.live2d, state]);
  const poseParameters = useMemo(
    () =>
      mapLive2DPoseInput({
        state,
        poseInput,
        elapsedSeconds: performance.now() / 1000,
        live2d: manifest.live2d
      }),
    [manifest.live2d, poseInput, state]
  );

  useEffect(() => {
    setRuntimeFailed(false);
  }, [model3, runtime]);

  useEffect(() => {
    if (!model3 || !runtime || runtimeFailed) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        const controller = await runtime.loadModel({ canvas, model3 });
        if (disposed) {
          controller.destroy?.();
          return;
        }

        controllerRef.current = controller;
      } catch (error) {
        if (!disposed) {
          console.warn("[Codex Avatar] Live2D runtime unavailable", error);
          setRuntimeFailed(true);
        }
      }
    })();

    return () => {
      disposed = true;
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
    };
  }, [model3, runtime, runtimeFailed]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    controller.startMotion?.(stateBinding.motion);
    controller.setExpression?.(stateBinding.expression);
  }, [stateBinding]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    if (controller.setParameterValues) {
      controller.setParameterValues(poseParameters);
      return;
    }

    for (const [parameterId, value] of Object.entries(poseParameters)) {
      controller.setParameterValue?.(parameterId, value);
    }
  }, [poseParameters]);

  useEffect(() => {
    if (!triggerEvent) {
      return;
    }

    controllerRef.current?.trigger?.(triggerEvent.trigger);
  }, [triggerEvent]);

  if (!model3 || !runtime || runtimeFailed) {
    return fallback;
  }

  return (
    <div
      className="live2d-runtime"
      data-avatar-state={state}
      data-live2d-motion={stateBinding.motion}
      data-live2d-expression={stateBinding.expression}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

function getLive2DRuntime(): Live2DRuntime | undefined {
  return typeof window === "undefined" ? undefined : window.__CODEX_LIVE2D_RUNTIME__;
}
