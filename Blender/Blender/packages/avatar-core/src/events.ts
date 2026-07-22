import type { AvatarState, AvatarTrigger, IdeAssistantEvent } from "./types.js";

export const eventToAvatarState: Record<IdeAssistantEvent, AvatarState> = {
  extension_ready: "welcome",
  active_editor_changed: "idle",
  text_document_changed: "coding",
  file_saved: "success",
  diagnostics_changed: "reviewing",
  terminal_started: "building",
  terminal_finished: "idle",
  task_started: "thinking",
  task_finished: "success",
  task_failed: "error",
  debug_started: "debugging",
  debug_stopped: "idle",
  workspace_trust_changed: "welcome",
  codex_task_started: "thinking",
  codex_task_thinking: "thinking",
  codex_task_streaming: "speaking",
  codex_task_finished: "success",
  codex_task_failed: "error",
  user_message_started: "listening",
  user_message_sent: "thinking",
  assistant_message_started: "speaking",
  assistant_message_streaming: "speaking",
  assistant_message_finished: "idle"
};

export const eventToAvatarTrigger: Partial<Record<IdeAssistantEvent, AvatarTrigger>> = {
  extension_ready: "nod",
  file_saved: "nod",
  task_finished: "celebrate",
  task_failed: "shake",
  codex_task_finished: "celebrate",
  codex_task_failed: "shake",
  workspace_trust_changed: "nod"
};

export function mapEventToAvatarState(event: IdeAssistantEvent): AvatarState {
  return eventToAvatarState[event];
}

export function mapEventToAvatarTrigger(event: IdeAssistantEvent): AvatarTrigger | undefined {
  return eventToAvatarTrigger[event];
}
