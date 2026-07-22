import type { AvatarManifest, AvatarPoseInput, AvatarState, Live2DParameterChannel } from "./types.js";

export type Live2DStateBinding = {
  motion: string;
  expression: string;
};

export type Live2DPoseMappingOptions = {
  state: AvatarState;
  poseInput?: AvatarPoseInput;
  elapsedSeconds?: number;
  live2d?: AvatarManifest["live2d"];
};

export const defaultLive2DParameterIds: Record<Live2DParameterChannel, string> = {
  mouthOpen: "ParamMouthOpenY",
  angleX: "ParamAngleX",
  angleY: "ParamAngleY",
  breath: "ParamBreath"
};

export const defaultLive2DMotions: Record<AvatarState, string> = {
  idle: "Idle",
  welcome: "Wave",
  listening: "Listen",
  thinking: "Think",
  speaking: "Talk",
  coding: "Focus",
  reviewing: "Review",
  debugging: "Debug",
  building: "Build",
  success: "Success",
  warning: "Warning",
  error: "Error",
  sleeping: "Sleep"
};

export const defaultLive2DExpressions: Record<AvatarState, string> = {
  idle: "neutral",
  welcome: "happy",
  listening: "curious",
  thinking: "focused",
  speaking: "talking",
  coding: "focused",
  reviewing: "curious",
  debugging: "concerned",
  building: "focused",
  success: "happy",
  warning: "concerned",
  error: "concerned",
  sleeping: "sleepy"
};

export function getLive2DModel3Path(manifest: Pick<AvatarManifest, "assets" | "live2d">): string | undefined {
  return manifest.live2d?.model3 ?? manifest.live2d?.model ?? manifest.assets?.live2d;
}

export function getLive2DStateBinding(state: AvatarState, live2d?: AvatarManifest["live2d"]): Live2DStateBinding {
  return {
    motion: live2d?.motions?.[state] ?? defaultLive2DMotions[state],
    expression: live2d?.expressions?.[state] ?? defaultLive2DExpressions[state]
  };
}

export function mapLive2DPoseInput({
  state,
  poseInput = {},
  elapsedSeconds = 0,
  live2d
}: Live2DPoseMappingOptions): Record<string, number> {
  const parameterIds = {
    ...defaultLive2DParameterIds,
    ...live2d?.parameters
  };
  const mouthInput = poseInput.mouthOpen ?? poseInput.audioLevel;
  const mouthOpen = clamp01(mouthInput ?? (state === "speaking" ? 0.48 + Math.sin(elapsedSeconds * 12) * 0.24 : 0));
  const cursorX = clamp01(poseInput.cursorX ?? 0.5);
  const cursorY = clamp01(poseInput.cursorY ?? 0.5);
  const breath =
    state === "sleeping" ? 0.22 + Math.sin(elapsedSeconds * 1.2) * 0.08 : 0.5 + Math.sin(elapsedSeconds * 2) * 0.5;

  return {
    [parameterIds.mouthOpen]: mouthOpen,
    [parameterIds.angleX]: clamp((cursorX - 0.5) * 30, -30, 30),
    [parameterIds.angleY]: clamp((0.5 - cursorY) * 20, -20, 20),
    [parameterIds.breath]: clamp01(breath)
  };
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
