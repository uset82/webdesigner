export type AudioReactiveMouthOptions = {
  attackMs?: number;
  releaseMs?: number;
  silenceThreshold?: number;
  onSpeakingStart?: () => void;
  onSpeakingStop?: () => void;
};

export type AudioMouthSnapshot = {
  amplitude: number;
  mouthOpen: number;
  speaking: boolean;
};

export class AudioReactiveMouth {
  private readonly attackMs: number;
  private readonly releaseMs: number;
  private readonly silenceThreshold: number;
  private readonly onSpeakingStart: (() => void) | undefined;
  private readonly onSpeakingStop: (() => void) | undefined;
  private smoothed = 0;
  private speaking = false;

  public constructor(options: AudioReactiveMouthOptions = {}) {
    this.attackMs = Math.max(1, options.attackMs ?? 45);
    this.releaseMs = Math.max(1, options.releaseMs ?? 160);
    this.silenceThreshold = clampUnit(options.silenceThreshold ?? 0.035);
    this.onSpeakingStart = options.onSpeakingStart;
    this.onSpeakingStop = options.onSpeakingStop;
  }

  public update(amplitude: number, deltaMs: number): AudioMouthSnapshot {
    const normalized = clampUnit(amplitude);
    const duration = normalized > this.smoothed ? this.attackMs : this.releaseMs;
    const alpha = 1 - Math.exp(-Math.max(0, deltaMs) / duration);
    this.smoothed += (normalized - this.smoothed) * alpha;
    if (this.smoothed < this.silenceThreshold) this.smoothed = 0;

    const nextSpeaking = this.smoothed > this.silenceThreshold;
    if (nextSpeaking && !this.speaking) this.onSpeakingStart?.();
    if (!nextSpeaking && this.speaking) this.onSpeakingStop?.();
    this.speaking = nextSpeaking;

    return { amplitude: normalized, mouthOpen: this.smoothed, speaking: this.speaking };
  }

  public reset(): AudioMouthSnapshot {
    this.smoothed = 0;
    const wasSpeaking = this.speaking;
    this.speaking = false;
    if (wasSpeaking) this.onSpeakingStop?.();
    return { amplitude: 0, mouthOpen: 0, speaking: false };
  }

  public snapshot(): AudioMouthSnapshot {
    return { amplitude: this.smoothed, mouthOpen: this.smoothed, speaking: this.speaking };
  }
}

export class MockAudioLevelGenerator {
  private index = 0;

  public constructor(private readonly levels: readonly number[] = [0, 0.25, 0.7, 0.35, 0]) {}

  public next(): number {
    const level = this.levels[this.index % this.levels.length] ?? 0;
    this.index += 1;
    return clampUnit(level);
  }

  public reset(): void {
    this.index = 0;
  }
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
