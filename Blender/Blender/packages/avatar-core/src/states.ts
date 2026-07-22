import type { AvatarState } from "./types.js";

export const AVATAR_STATE_NUMBERS: Record<AvatarState, number> = {
  idle: 0,
  welcome: 1,
  listening: 2,
  thinking: 3,
  speaking: 4,
  coding: 5,
  reviewing: 6,
  debugging: 7,
  building: 8,
  success: 9,
  warning: 10,
  error: 11,
  sleeping: 12
};

export function getAvatarStateNumber(state: AvatarState): number {
  return AVATAR_STATE_NUMBERS[state];
}
