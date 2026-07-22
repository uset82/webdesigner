import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getAvatarStateNumber, type AvatarManifest, type AvatarPoseInput, type AvatarState, type AvatarTrigger } from "@codex-avatar-studio/avatar-core";
import { useRive, useStateMachineInput } from "@rive-app/react-webgl2";

type RiveAvatarRendererProps = {
  state: AvatarState;
  poseInput: AvatarPoseInput;
  manifest: AvatarManifest;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
  fallback: ReactNode;
};

export function RiveAvatarRenderer({ state, poseInput, manifest, triggerEvent, fallback }: RiveAvatarRendererProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const riveAsset = manifest.assets.rive;
  const stateMachineName = manifest.rive?.stateMachine ?? "CodexAssistant";
  const inputNames = manifest.rive?.inputs ?? {};

  const riveParams = useMemo(
    () =>
      riveAsset
        ? {
            src: riveAsset,
            stateMachines: stateMachineName,
            autoplay: true,
            onLoadError: () => setLoadFailed(true)
          }
        : undefined,
    [riveAsset, stateMachineName]
  );

  const { rive, RiveComponent } = useRive(riveParams, {
    shouldResizeCanvasToContainer: true
  });

  const stateInput = useStateMachineInput(rive, stateMachineName, inputNames.state ?? "state", getAvatarStateNumber(state));
  const cursorXInput = useStateMachineInput(rive, stateMachineName, inputNames.cursorX ?? "cursorX", poseInput.cursorX ?? 0.5);
  const cursorYInput = useStateMachineInput(rive, stateMachineName, inputNames.cursorY ?? "cursorY", poseInput.cursorY ?? 0.5);
  const mouthOpenInput = useStateMachineInput(rive, stateMachineName, inputNames.mouthOpen ?? "mouthOpen", poseInput.mouthOpen ?? 0);
  const scrollProgressInput = useStateMachineInput(
    rive,
    stateMachineName,
    inputNames.scrollProgress ?? "scrollProgress",
    poseInput.scrollProgress ?? 0
  );
  const isSpeakingInput = useStateMachineInput(rive, stateMachineName, inputNames.isSpeaking ?? "isSpeaking", state === "speaking");
  const isThinkingInput = useStateMachineInput(rive, stateMachineName, inputNames.isThinking ?? "isThinking", state === "thinking");
  const waveInput = useStateMachineInput(rive, stateMachineName, inputNames.wave ?? "wave");
  const celebrateInput = useStateMachineInput(rive, stateMachineName, inputNames.celebrate ?? "celebrate");
  const confusedInput = useStateMachineInput(rive, stateMachineName, inputNames.confused ?? "confused");
  const pointInput = useStateMachineInput(rive, stateMachineName, inputNames.point ?? "point");

  useEffect(() => {
    if (stateInput) {
      stateInput.value = getAvatarStateNumber(state);
    }
    if (isSpeakingInput) {
      isSpeakingInput.value = state === "speaking";
    }
    if (isThinkingInput) {
      isThinkingInput.value = state === "thinking";
    }
  }, [isSpeakingInput, isThinkingInput, state, stateInput]);

  useEffect(() => {
    if (cursorXInput && poseInput.cursorX !== undefined) {
      cursorXInput.value = poseInput.cursorX;
    }
    if (cursorYInput && poseInput.cursorY !== undefined) {
      cursorYInput.value = poseInput.cursorY;
    }
    if (mouthOpenInput && poseInput.mouthOpen !== undefined) {
      mouthOpenInput.value = poseInput.mouthOpen;
    }
    if (scrollProgressInput && poseInput.scrollProgress !== undefined) {
      scrollProgressInput.value = poseInput.scrollProgress;
    }
  }, [cursorXInput, cursorYInput, mouthOpenInput, poseInput, scrollProgressInput]);

  useEffect(() => {
    if (!triggerEvent) {
      return;
    }

    const triggerInputs: Partial<Record<AvatarTrigger, { fire: () => void } | null>> = {
      wave: waveInput,
      celebrate: celebrateInput,
      confused: confusedInput,
      point: pointInput
    };
    triggerInputs[triggerEvent.trigger]?.fire();
  }, [celebrateInput, confusedInput, pointInput, triggerEvent, waveInput]);

  if (!riveAsset || loadFailed) {
    return fallback;
  }

  return (
    <div className="rive-runtime" data-avatar-state={state}>
      <RiveComponent aria-hidden="true" />
    </div>
  );
}
