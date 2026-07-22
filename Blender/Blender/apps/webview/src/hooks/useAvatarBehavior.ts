import { useEffect, useMemo, useRef, useState } from "react";
import { AudioReactiveMouth } from "@codex-avatar-studio/avatar-core";
import type { AvatarConfig, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";

type AvatarBehaviorOptions = {
  externalState: AvatarState;
  externalMessage: string | null;
  externalPoseInput: AvatarPoseInput;
  config: AvatarConfig;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
};

export type AvatarBehaviorState = {
  displayState: AvatarState;
  displayMessage: string | null;
  poseInput: AvatarPoseInput;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
};

const idleBeforeSleepMs = 90_000;
const transientStateMs = 2_800;
const speechBubbleCooldownMs = 4_000;

export function useAvatarBehavior(options: AvatarBehaviorOptions): AvatarBehaviorState {
  const [displayState, setDisplayState] = useState<AvatarState>(options.externalState);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [cursorPose, setCursorPose] = useState<AvatarPoseInput>({ cursorX: 0.5, cursorY: 0.5 });
  const [mouthOpen, setMouthOpen] = useState(0);
  const audioMouth = useRef(new AudioReactiveMouth());
  const lastAudioAt = useRef(Date.now());
  const lastSpeechBubbleAt = useRef(0);
  const pendingPointerPose = useRef<AvatarPoseInput | null>(null);
  const pointerFrame = useRef<number | null>(null);

  const nextDisplayMessage = useMemo(() => {
    if (!options.config.showSpeechBubble || options.config.focusMode) {
      return null;
    }

    return options.externalMessage ?? messageForState(displayState);
  }, [displayState, options.config.focusMode, options.config.showSpeechBubble, options.externalMessage]);

  useEffect(() => {
    if (nextDisplayMessage === null) {
      setDisplayMessage(null);
      return;
    }

    const now = Date.now();
    const isHighSignal =
      options.externalMessage !== null ||
      displayState === "welcome" ||
      displayState === "speaking" ||
      displayState === "success" ||
      displayState === "warning" ||
      displayState === "error";

    setDisplayMessage((previous) => {
      if (previous === nextDisplayMessage) {
        return previous;
      }

      if (previous === null || isHighSignal || now - lastSpeechBubbleAt.current >= speechBubbleCooldownMs) {
        lastSpeechBubbleAt.current = now;
        return nextDisplayMessage;
      }

      return previous;
    });
  }, [displayState, nextDisplayMessage, options.externalMessage]);

  useEffect(() => {
    setDisplayState(options.externalState);
    setLastActivityAt(Date.now());
  }, [options.externalState]);

  useEffect(() => {
    const handleActivity = () => {
      setLastActivityAt(Date.now());
      setDisplayState((previous) => (previous === "sleeping" ? "idle" : previous));
    };

    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("focus", handleActivity);
    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("focus", handleActivity);
    };
  }, []);

  useEffect(() => {
    if (options.config.focusMode) {
      return;
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityAt > idleBeforeSleepMs) {
        setDisplayState("sleeping");
      }
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [lastActivityAt, options.config.focusMode]);

  useEffect(() => {
    if (!["success", "warning", "error"].includes(displayState)) {
      return;
    }

    const timer = window.setTimeout(() => setDisplayState("idle"), transientStateMs);
    return () => window.clearTimeout(timer);
  }, [displayState]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      pendingPointerPose.current = {
        cursorX: clamp(event.clientX / width),
        cursorY: clamp(event.clientY / height)
      };

      if (pointerFrame.current !== null) {
        return;
      }

      pointerFrame.current = window.requestAnimationFrame(() => {
        pointerFrame.current = null;
        if (pendingPointerPose.current) {
          setCursorPose(pendingPointerPose.current);
          pendingPointerPose.current = null;
          setLastActivityAt(Date.now());
        }
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (pointerFrame.current !== null) {
        window.cancelAnimationFrame(pointerFrame.current);
        pointerFrame.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!options.config.lipSyncEnabled || options.config.noAnimation) {
      audioMouth.current.reset();
      setMouthOpen(0);
      return;
    }

    const amplitude = options.externalPoseInput.audioLevel ?? options.externalPoseInput.speechLevel;
    if (amplitude === undefined) return;
    const now = Date.now();
    const snapshot = audioMouth.current.update(amplitude, Math.max(1, now - lastAudioAt.current));
    lastAudioAt.current = now;
    setMouthOpen(snapshot.mouthOpen);
  }, [
    options.config.lipSyncEnabled,
    options.config.noAnimation,
    options.externalPoseInput.audioLevel,
    options.externalPoseInput.speechLevel
  ]);

  useEffect(() => {
    if (displayState !== "speaking" || options.config.focusMode) {
      setMouthOpen(0);
      return;
    }

    if (
      !options.config.lipSyncEnabled ||
      options.config.noAnimation ||
      options.externalPoseInput.audioLevel !== undefined ||
      options.externalPoseInput.speechLevel !== undefined
    ) {
      return;
    }

    const chunks = chunkMessage(displayMessage ?? "");
    let index = 0;
    const timer = window.setInterval(() => {
      setMouthOpen(estimateMouthOpenFromText(chunks[index % chunks.length] ?? ""));
      index += 1;
    }, 180);

    return () => window.clearInterval(timer);
  }, [
    displayMessage,
    displayState,
    options.config.focusMode,
    options.config.lipSyncEnabled,
    options.config.noAnimation,
    options.externalPoseInput.audioLevel,
    options.externalPoseInput.speechLevel
  ]);

  return {
    displayState,
    displayMessage,
    poseInput: {
      ...cursorPose,
      ...options.externalPoseInput,
      mouthOpen,
      speechLevel: mouthOpen
    },
    triggerEvent: options.triggerEvent
  };
}

export function estimateMouthOpenFromText(textChunk: string): number {
  const vowels = textChunk.match(/[aeiouAEIOU]/g)?.length ?? 0;
  const punctuation = textChunk.match(/[.!?]/g)?.length ?? 0;
  const raw = Math.min(1, vowels / 8);
  return punctuation > 0 ? Math.max(0.15, raw * 0.5) : raw;
}

function chunkMessage(message: string): string[] {
  if (!message.trim()) {
    return ["talking"];
  }

  return message.match(/.{1,8}/g) ?? [message];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function messageForState(state: AvatarState): string {
  const messages: Record<AvatarState, string> = {
    idle: "Ready.",
    welcome: "Ready to build.",
    listening: "Listening.",
    thinking: "Analyzing the code.",
    speaking: "I found a possible path.",
    coding: "Following your edits.",
    reviewing: "Checking diagnostics.",
    debugging: "Following the debug session.",
    building: "Running the task.",
    success: "Done.",
    warning: "Something needs attention.",
    error: "There is a problem to inspect.",
    sleeping: "Quiet until needed."
  };

  return messages[state];
}
