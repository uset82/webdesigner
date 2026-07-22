import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakeVscode = vi.hoisted(() => {
  const createSignal = () => {
    const listeners: Array<(...args: unknown[]) => void> = [];
    return {
      on: vi.fn((listener: (...args: unknown[]) => void) => {
        listeners.push(listener);
        return { dispose: vi.fn(() => listeners.splice(listeners.indexOf(listener), 1)) };
      }),
      fire: (...args: unknown[]) => {
        for (const listener of [...listeners]) listener(...args);
      },
      reset: () => listeners.splice(0),
      size: () => listeners.length
    };
  };

  const signals = {
    activeEditor: createSignal(),
    documentChanged: createSignal(),
    documentSaved: createSignal(),
    diagnostics: createSignal(),
    debugStarted: createSignal(),
    debugStopped: createSignal(),
    terminalOpened: createSignal(),
    terminalClosed: createSignal(),
    taskStarted: createSignal(),
    taskEnded: createSignal(),
    taskProcessEnded: createSignal(),
    trustGranted: createSignal()
  };

  return {
    signals,
    api: {
      window: {
        onDidChangeActiveTextEditor: signals.activeEditor.on,
        onDidOpenTerminal: signals.terminalOpened.on,
        onDidCloseTerminal: signals.terminalClosed.on
      },
      workspace: {
        onDidChangeTextDocument: signals.documentChanged.on,
        onDidSaveTextDocument: signals.documentSaved.on,
        onDidGrantWorkspaceTrust: signals.trustGranted.on
      },
      languages: {
        onDidChangeDiagnostics: signals.diagnostics.on,
        getDiagnostics: vi.fn(() => [])
      },
      debug: {
        onDidStartDebugSession: signals.debugStarted.on,
        onDidTerminateDebugSession: signals.debugStopped.on
      },
      tasks: {
        onDidStartTask: signals.taskStarted.on,
        onDidEndTask: signals.taskEnded.on,
        onDidEndTaskProcess: signals.taskProcessEnded.on
      },
      DiagnosticSeverity: { Error: 0, Warning: 1 }
    }
  };
});

vi.mock("vscode", () => fakeVscode.api);

import { IdeEventsController } from "../src/ideEvents.js";

function createSink() {
  return {
    setState: vi.fn(),
    trigger: vi.fn(),
    debugEvent: vi.fn()
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const signal of Object.values(fakeVscode.signals)) signal.reset();
  fakeVscode.api.languages.getDiagnostics.mockReset();
  fakeVscode.api.languages.getDiagnostics.mockReturnValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IdeEventsController", () => {
  it("trailing-throttles rapid document changes and maps task exit codes", () => {
    const sink = createSink();
    const controller = new IdeEventsController(sink, { textChangeThrottleMs: 100, taskCompletionGraceMs: 200 });
    controller.start();
    sink.setState.mockClear();

    const document = { isClosed: false, languageId: "typescript", fileName: "file.ts" };
    for (let index = 0; index < 10; index += 1) {
      fakeVscode.signals.documentChanged.fire({ document, contentChanges: [{}] });
    }
    vi.advanceTimersByTime(99);
    expect(sink.setState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sink.setState).toHaveBeenCalledTimes(1);
    expect(sink.setState).toHaveBeenLastCalledWith("coding");

    const execution = { task: { name: "build" } };
    fakeVscode.signals.taskEnded.fire({ execution });
    fakeVscode.signals.taskProcessEnded.fire({ execution, exitCode: 1 });
    expect(sink.setState).toHaveBeenLastCalledWith("error");
    expect(sink.trigger).toHaveBeenLastCalledWith("shake");

    controller.dispose();
  });

  it("reacts to file saves, task starts, and successful task completion", () => {
    const sink = createSink();
    const controller = new IdeEventsController(sink, { taskCompletionGraceMs: 100 });
    controller.start();
    sink.setState.mockClear();
    sink.trigger.mockClear();

    fakeVscode.signals.documentSaved.fire({ languageId: "typescript", fileName: "saved.ts" });
    expect(sink.setState).toHaveBeenLastCalledWith("success");
    expect(sink.trigger).toHaveBeenLastCalledWith("nod");

    const execution = { task: { name: "test" } };
    fakeVscode.signals.taskStarted.fire({ execution });
    expect(sink.setState).toHaveBeenLastCalledWith("thinking");

    fakeVscode.signals.taskEnded.fire({ execution });
    vi.advanceTimersByTime(100);
    expect(sink.setState).toHaveBeenLastCalledWith("success");
    expect(sink.trigger).toHaveBeenLastCalledWith("celebrate");

    controller.dispose();
  });

  it("debounces diagnostics, handles public listeners, sleeps, and disposes listeners", () => {
    const sink = createSink();
    const controller = new IdeEventsController(sink, {
      diagnosticsDebounceMs: 100,
      sleepDelayMs: 500,
      defaultIdleDelayMs: 20
    });
    controller.start();
    sink.setState.mockClear();
    fakeVscode.api.languages.getDiagnostics.mockReturnValue([{ severity: fakeVscode.api.DiagnosticSeverity.Warning }]);

    fakeVscode.signals.diagnostics.fire({ uris: [{ toString: () => "file:///a.ts" }] });
    fakeVscode.signals.diagnostics.fire({ uris: [{ toString: () => "file:///b.ts" }] });
    vi.advanceTimersByTime(99);
    expect(sink.setState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sink.setState).toHaveBeenLastCalledWith("warning");

    fakeVscode.api.languages.getDiagnostics.mockReturnValueOnce(undefined as never);
    fakeVscode.signals.diagnostics.fire({ uris: [{ toString: () => "file:///unavailable.ts" }] });
    vi.advanceTimersByTime(100);
    expect(sink.debugEvent).toHaveBeenCalledWith("diagnostics_unavailable");

    fakeVscode.signals.terminalOpened.fire({ name: "terminal" });
    expect(sink.setState).toHaveBeenLastCalledWith("building");
    fakeVscode.signals.trustGranted.fire();
    expect(sink.setState).toHaveBeenLastCalledWith("welcome");

    vi.advanceTimersByTime(521);
    expect(sink.setState).toHaveBeenLastCalledWith("sleeping");

    controller.dispose();
    const callsBeforeDispose = sink.setState.mock.calls.length;
    fakeVscode.signals.activeEditor.fire({ document: { languageId: "javascript" } });
    expect(sink.setState).toHaveBeenCalledTimes(callsBeforeDispose);
    expect(fakeVscode.signals.activeEditor.size()).toBe(0);
  });
});
