import { describe, expect, it } from "vitest";
import { AvatarStateMachine } from "../src/stateMachine.js";

describe("AvatarStateMachine", () => {
  it("enforces priority while allowing speaking to interrupt thinking", () => {
    const machine = new AvatarStateMachine();
    expect(machine.transition("thinking", 0)).toBe(true);
    expect(machine.handleEvent("active_editor_changed", 1)).toBe(false);
    expect(machine.handleEvent("assistant_message_started", 2)).toBe(true);
    expect(machine.state).toBe("speaking");
  });

  it("returns temporary states to the previous state and protects building", () => {
    const machine = new AvatarStateMachine({ durations: { success: 100 } });
    machine.transition("coding", 0);
    machine.transition("success", 10);
    expect(machine.tick(109)).toBe(false);
    expect(machine.tick(110)).toBe(true);
    expect(machine.state).toBe("coding");
    machine.transition("building", 200);
    expect(machine.handleEvent("active_editor_changed", 201)).toBe(false);
  });

  it("debounces diagnostics and exits sleeping on interaction", () => {
    const machine = new AvatarStateMachine({ diagnosticDebounceMs: 100 });
    expect(machine.handleEvent("diagnostics_changed", 0)).toBe(true);
    expect(machine.handleEvent("diagnostics_changed", 50)).toBe(false);
    machine.transition("sleeping", 200, "debug");
    expect(machine.handleEvent("active_editor_changed", 201)).toBe(true);
    expect(machine.state).toBe("idle");
  });

  it("keeps reduced motion semantics while removing temporary expiry", () => {
    const machine = new AvatarStateMachine({ reducedMotion: true });
    machine.transition("success", 0);
    expect(machine.state).toBe("success");
    expect(machine.tick(100_000)).toBe(false);
    expect(machine.snapshot().reducedMotion).toBe(true);
  });
});
