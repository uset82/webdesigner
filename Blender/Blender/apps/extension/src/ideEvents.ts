import * as vscode from "vscode";
import {
  mapEventToAvatarState,
  mapEventToAvatarTrigger,
  type AvatarState,
  type AvatarTrigger,
  type IdeAssistantEvent
} from "@codex-avatar-studio/avatar-core";

export type AvatarEventSink = {
  setState(state: AvatarState): void;
  trigger(trigger: AvatarTrigger): void;
  debugEvent(event: string, payload?: unknown): void;
};

export type IdeEventsOptions = {
  textChangeThrottleMs?: number;
  diagnosticsDebounceMs?: number;
  defaultIdleDelayMs?: number;
  sleepDelayMs?: number;
  taskCompletionGraceMs?: number;
};

type IdleOptions = { returnToIdle?: boolean; idleDelayMs?: number };

export class IdeEventsController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly options: Required<IdeEventsOptions>;
  private diagnosticsTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingDiagnostics: vscode.DiagnosticChangeEvent | undefined;
  private textChangeTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingTextChange: { languageId?: string; fileName?: string } | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private sleepTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly taskCompletionTimers = new WeakMap<vscode.TaskExecution, ReturnType<typeof setTimeout>>();
  private readonly processTaskExecutions = new WeakSet<vscode.TaskExecution>();
  private started = false;

  public constructor(
    private readonly sink: AvatarEventSink,
    options: IdeEventsOptions = {}
  ) {
    this.options = {
      textChangeThrottleMs: options.textChangeThrottleMs ?? 120,
      diagnosticsDebounceMs: options.diagnosticsDebounceMs ?? 350,
      defaultIdleDelayMs: options.defaultIdleDelayMs ?? 1800,
      sleepDelayMs: options.sleepDelayMs ?? 5 * 60 * 1000,
      taskCompletionGraceMs: options.taskCompletionGraceMs ?? 200
    };
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.emit("active_editor_changed", { languageId: editor?.document.languageId });
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (!event.document.isClosed && event.contentChanges.length > 0) this.queueTextChange(event.document);
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.emit(
          "file_saved",
          { languageId: document.languageId, fileName: document.fileName },
          { returnToIdle: true }
        );
      }),
      vscode.languages.onDidChangeDiagnostics((event) => {
        this.debounceDiagnostics(event);
      }),
      vscode.debug.onDidStartDebugSession((session) => {
        this.emit("debug_started", { type: session.type, name: session.name });
      }),
      vscode.debug.onDidTerminateDebugSession((session) => {
        this.emit("debug_stopped", { type: session.type, name: session.name }, { returnToIdle: true });
      }),
      vscode.window.onDidOpenTerminal((terminal) => {
        this.emit("terminal_started", { name: terminal.name });
      }),
      vscode.window.onDidCloseTerminal((terminal) => {
        this.emit("terminal_finished", { name: terminal.name }, { returnToIdle: true });
      }),
      vscode.tasks.onDidStartTask((event) => {
        this.emit("task_started", { name: event.execution.task.name });
      }),
      vscode.tasks.onDidEndTask((event) => {
        this.scheduleTaskCompletion(event.execution);
      })
    );

    const taskProcessListener = vscode.tasks.onDidEndTaskProcess?.((event) => {
      this.completeTaskProcess(event.execution, event.exitCode);
    });
    if (taskProcessListener) this.disposables.push(taskProcessListener);

    const trustListener = vscode.workspace.onDidGrantWorkspaceTrust?.(() => {
      this.emit("workspace_trust_changed", undefined, { returnToIdle: true });
    });
    if (trustListener) this.disposables.push(trustListener);

    this.emit("extension_ready", undefined, { returnToIdle: true, idleDelayMs: 2200 });
  }

  public emitEvent(event: IdeAssistantEvent, payload?: unknown): void {
    this.emit(event, payload);
  }

  public updateTiming(idleTimeoutSeconds: number, sleepTimeoutSeconds: number): void {
    this.options.defaultIdleDelayMs = Math.max(0, idleTimeoutSeconds * 1000);
    this.options.sleepDelayMs = Math.max(0, sleepTimeoutSeconds * 1000);
    this.scheduleSleep();
  }

  public setManualState(state: AvatarState, trigger?: AvatarTrigger): void {
    this.clearIdleTimer();
    this.scheduleSleep();
    this.sink.setState(state);
    if (trigger) this.sink.trigger(trigger);
    this.sink.debugEvent(`manual:${state}`);

    if (state === "success" || state === "warning" || state === "error") {
      this.scheduleIdle();
    }
  }

  public dispose(): void {
    this.started = false;
    this.clearDiagnosticsTimer();
    this.clearTextChangeTimer();
    this.clearIdleTimer();
    this.clearSleepTimer();
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
  }

  private queueTextChange(document: vscode.TextDocument): void {
    this.pendingTextChange = { languageId: document.languageId, fileName: document.fileName };
    if (this.textChangeTimer) return;
    this.textChangeTimer = setTimeout(() => {
      this.textChangeTimer = undefined;
      const payload = this.pendingTextChange;
      this.pendingTextChange = undefined;
      this.emit("text_document_changed", payload, { returnToIdle: true, idleDelayMs: 1200 });
    }, this.options.textChangeThrottleMs);
  }

  private debounceDiagnostics(event: vscode.DiagnosticChangeEvent): void {
    this.clearDiagnosticsTimer();
    this.pendingDiagnostics = event;
    this.diagnosticsTimer = setTimeout(() => {
      this.diagnosticsTimer = undefined;
      const pending = this.pendingDiagnostics;
      this.pendingDiagnostics = undefined;
      if (!pending) return;
      const state = this.getDiagnosticsState(pending.uris);
      this.applyState(
        state,
        "diagnostics_changed",
        { uriCount: pending.uris.length },
        { returnToIdle: state !== "reviewing" }
      );
    }, this.options.diagnosticsDebounceMs);
  }

  private getDiagnosticsState(uris: readonly vscode.Uri[]): AvatarState {
    try {
      const diagnostics = uris.flatMap((uri) => vscode.languages.getDiagnostics(uri));
      if (diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error)) return "error";
      if (diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Warning)) return "warning";
      return mapEventToAvatarState("diagnostics_changed");
    } catch {
      this.sink.debugEvent("diagnostics_unavailable");
      return "idle";
    }
  }

  private scheduleTaskCompletion(execution: vscode.TaskExecution): void {
    if (this.processTaskExecutions.has(execution)) return;
    const timer = setTimeout(() => {
      this.taskCompletionTimers.delete(execution);
      if (!this.processTaskExecutions.has(execution)) {
        this.emit("task_finished", { name: execution.task.name }, { returnToIdle: true });
      }
    }, this.options.taskCompletionGraceMs);
    this.taskCompletionTimers.set(execution, timer);
  }

  private completeTaskProcess(execution: vscode.TaskExecution, exitCode: number | undefined): void {
    this.processTaskExecutions.add(execution);
    const timer = this.taskCompletionTimers.get(execution);
    if (timer) clearTimeout(timer);
    this.taskCompletionTimers.delete(execution);
    const payload = { name: execution.task.name, exitCode: exitCode ?? null };
    this.emit(exitCode === undefined || exitCode === 0 ? "task_finished" : "task_failed", payload, {
      returnToIdle: true
    });
  }

  private emit(event: IdeAssistantEvent, payload?: unknown, options: IdleOptions = {}): void {
    this.applyState(mapEventToAvatarState(event), event, payload, options);
    const trigger = mapEventToAvatarTrigger(event);
    if (trigger) this.sink.trigger(trigger);
  }

  private applyState(state: AvatarState, event: string, payload?: unknown, options: IdleOptions = {}): void {
    this.clearIdleTimer();
    this.scheduleSleep();
    this.sink.setState(state);
    this.sink.debugEvent(event, payload);

    if (options.returnToIdle) this.scheduleIdle(options.idleDelayMs);
  }

  private scheduleIdle(delayMs = this.options.defaultIdleDelayMs): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      this.sink.setState("idle");
      this.sink.debugEvent("idle_timeout");
      this.scheduleSleep();
    }, delayMs);
  }

  private scheduleSleep(): void {
    this.clearSleepTimer();
    if (this.options.sleepDelayMs <= 0) return;
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = undefined;
      this.clearIdleTimer();
      this.sink.setState("sleeping");
      this.sink.debugEvent("sleep_timeout");
    }, this.options.sleepDelayMs);
  }

  private clearDiagnosticsTimer(): void {
    if (this.diagnosticsTimer) clearTimeout(this.diagnosticsTimer);
    this.diagnosticsTimer = undefined;
    this.pendingDiagnostics = undefined;
  }

  private clearTextChangeTimer(): void {
    if (this.textChangeTimer) clearTimeout(this.textChangeTimer);
    this.textChangeTimer = undefined;
    this.pendingTextChange = undefined;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private clearSleepTimer(): void {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = undefined;
  }
}
