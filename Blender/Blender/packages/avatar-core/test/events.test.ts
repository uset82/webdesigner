import assert from "node:assert/strict";
import { test } from "vitest";
import { getAvatarStateNumber, mapEventToAvatarState, mapEventToAvatarTrigger } from "../src/index.js";

test("maps IDE events to avatar states and triggers", () => {
  assert.equal(mapEventToAvatarState("extension_ready"), "welcome");
  assert.equal(mapEventToAvatarState("file_saved"), "success");
  assert.equal(mapEventToAvatarState("text_document_changed"), "coding");
  assert.equal(mapEventToAvatarState("codex_task_streaming"), "speaking");
  assert.equal(mapEventToAvatarState("codex_task_failed"), "error");

  assert.equal(mapEventToAvatarTrigger("extension_ready"), "nod");
  assert.equal(mapEventToAvatarTrigger("file_saved"), "nod");
  assert.equal(mapEventToAvatarTrigger("codex_task_finished"), "celebrate");
});

test("exposes stable numeric state mapping for runtimes", () => {
  assert.equal(getAvatarStateNumber("idle"), 0);
  assert.equal(getAvatarStateNumber("speaking"), 4);
  assert.equal(getAvatarStateNumber("sleeping"), 12);
});
