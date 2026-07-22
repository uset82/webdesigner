import type { IdeAssistantEvent, AvatarState } from "./types.js";
import { mapEventToAvatarState } from "./events.js";

export type AvatarStateMachineOptions = {
  durations?: Partial<Record<AvatarState, number>>;
  reducedMotion?: boolean;
  lowPerformance?: boolean;
  diagnosticDebounceMs?: number;
  logger?: (entry: AvatarTransitionLog) => void;
};

export type AvatarTransitionLog = {
  from: AvatarState;
  to: AvatarState;
  reason: string;
  at: number;
};

export type AvatarStateSnapshot = {
  state: AvatarState;
  previousState: AvatarState | undefined;
  expiresAt: number | undefined;
  reducedMotion: boolean;
  lowPerformance: boolean;
};

const priority: Record<AvatarState, number> = {
  idle: 0,
  sleeping: 0,
  coding: 1,
  thinking: 2,
  building: 3,
  debugging: 4,
  reviewing: 4,
  speaking: 5,
  listening: 5,
  welcome: 5,
  success: 6,
  warning: 7,
  error: 8
};

const defaultDurations: Partial<Record<AvatarState, number>> = {
  welcome: 1800,
  success: 2200,
  warning: 4500,
  error: 6500
};

export class AvatarStateMachine {
  private current: AvatarState = "idle";
  private previous: AvatarState | undefined;
  private expiresAt: number | undefined;
  private lastDiagnosticAt = -Infinity;
  private readonly durations: Partial<Record<AvatarState, number>>;
  private readonly logger: ((entry: AvatarTransitionLog) => void) | undefined;
  readonly reducedMotion: boolean;
  readonly lowPerformance: boolean;
  readonly diagnosticDebounceMs: number;

  constructor(options: AvatarStateMachineOptions = {}) {
    this.durations = { ...defaultDurations, ...options.durations };
    this.reducedMotion = options.reducedMotion ?? false;
    this.lowPerformance = options.lowPerformance ?? false;
    this.diagnosticDebounceMs = options.diagnosticDebounceMs ?? 250;
    this.logger = options.logger;
  }

  get state(): AvatarState {
    return this.current;
  }

  snapshot(): AvatarStateSnapshot {
    return {
      state: this.current,
      previousState: this.previous,
      expiresAt: this.expiresAt,
      reducedMotion: this.reducedMotion,
      lowPerformance: this.lowPerformance
    };
  }

  transition(next: AvatarState, now = Date.now(), reason = "manual"): boolean {
    if (next === this.current) return false;
    if (!this.canInterrupt(next, reason)) return false;
    this.apply(next, now, reason);
    return true;
  }

  handleEvent(event: IdeAssistantEvent, now = Date.now()): boolean {
    if (event === "diagnostics_changed") {
      if (now - this.lastDiagnosticAt < this.diagnosticDebounceMs) return false;
      this.lastDiagnosticAt = now;
    }
    if (event === "active_editor_changed" && this.current === "sleeping") {
      return this.transition("idle", now, event);
    }
    return this.transition(mapEventToAvatarState(event), now, event);
  }

  tick(now = Date.now()): boolean {
    if (this.expiresAt === undefined || now < this.expiresAt) return false;
    const returnState = this.previous && this.previous !== this.current ? this.previous : "idle";
    this.apply(returnState, now, "timeout");
    return true;
  }

  private canInterrupt(next: AvatarState, reason: string): boolean {
    if (reason === "manual" || reason === "debug") return true;
    if (this.current === "building" && next === "idle") return false;
    if (priority[next] < priority[this.current]) return false;
    return true;
  }

  private apply(next: AvatarState, now: number, reason: string): void {
    const from = this.current;
    this.previous = from;
    this.current = next;
    const duration = this.reducedMotion || this.lowPerformance ? undefined : this.durations[next];
    this.expiresAt = duration === undefined ? undefined : now + duration;
    this.logger?.({ from, to: next, reason, at: now });
  }
}
