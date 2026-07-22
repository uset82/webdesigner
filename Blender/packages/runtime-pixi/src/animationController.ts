import type { AvatarState, AvatarTrigger } from "@codex-avatar-studio/avatar-core";
import { clipForState, clipForTrigger, type SpriteClip, type SpriteSheetManifest } from "./spritesheet.js";

export type AnimationControllerOptions = {
  lowPerformance?: boolean;
  random?: () => number;
  onComplete?: (clip: SpriteClip) => void;
};

export type AnimationSnapshot = {
  clip: SpriteClip;
  state: AvatarState;
  oneShot: boolean;
};

export class SpriteAnimationController {
  private state: AvatarState = "idle";
  private active: AnimationSnapshot;
  private readonly random: () => number;
  private readonly onComplete: ((clip: SpriteClip) => void) | undefined;
  private readonly lowPerformance: boolean;

  public constructor(
    private readonly manifest: SpriteSheetManifest,
    options: AnimationControllerOptions = {}
  ) {
    this.lowPerformance = options.lowPerformance ?? false;
    this.random = options.random ?? Math.random;
    this.onComplete = options.onComplete;
    this.active = { clip: clipForState(manifest, "idle"), state: "idle", oneShot: false };
  }

  public setState(state: AvatarState): AnimationSnapshot {
    this.state = state;
    this.active = { clip: this.selectIdleVariant(state), state, oneShot: false };
    return this.active;
  }

  public trigger(trigger: AvatarTrigger): AnimationSnapshot | undefined {
    const clip = clipForTrigger(this.manifest, trigger);
    if (!clip || (this.lowPerformance && (trigger === "show-particles" || clip.name.includes("particle")))) {
      return undefined;
    }
    const currentPriority = this.active.clip.priority ?? 0;
    if ((clip.priority ?? 0) < currentPriority) return this.active;
    this.active = { clip, state: this.state, oneShot: clip.loop !== true };
    return this.active;
  }

  public completeOneShot(): AnimationSnapshot {
    if (this.active.oneShot) this.onComplete?.(this.active.clip);
    return this.setState(this.state);
  }

  public snapshot(): AnimationSnapshot {
    return this.active;
  }

  public frameAt(elapsedMs: number): number {
    const frames = this.active.clip.frames;
    const fps = this.active.clip.fps ?? 12;
    const frameIndex = Math.floor((Math.max(0, elapsedMs) * fps) / 1000);
    return (
      frames[this.active.clip.loop === true ? frameIndex % frames.length : Math.min(frameIndex, frames.length - 1)] ?? 0
    );
  }

  public isComplete(elapsedMs: number): boolean {
    if (!this.active.oneShot) return false;
    const fps = this.active.clip.fps ?? 12;
    return elapsedMs >= (this.active.clip.frames.length / fps) * 1000;
  }

  private selectIdleVariant(state: AvatarState): SpriteClip {
    const base = clipForState(this.manifest, state);
    if (state !== "idle") return base;
    const variants = Object.values(this.manifest.clips).filter(
      (clip) => clip.name.startsWith("idle_") && clip.name !== base.name
    );
    if (variants.length > 0 && this.random() >= 0.5) {
      return variants[Math.floor(this.random() * variants.length)] ?? base;
    }
    return base;
  }
}
