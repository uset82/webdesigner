export type WebAudioLevelAdapterOptions = {
  fftSize?: number;
  smoothingTimeConstant?: number;
};

/** Local playback analyser. It never requests microphone access. */
export class WebAudioLevelAdapter {
  private context: AudioContext | undefined;
  private analyser: AnalyserNode | undefined;
  private source: MediaElementAudioSourceNode | undefined;
  private levels: Uint8Array<ArrayBuffer> | undefined;
  private active = false;

  public connect(media: HTMLMediaElement, options: WebAudioLevelAdapterOptions = {}): void {
    this.disconnect();
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) throw new Error("Web Audio API is unavailable in this Webview.");
    this.context = new AudioContextConstructor();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = options.fftSize ?? 512;
    this.analyser.smoothingTimeConstant = options.smoothingTimeConstant ?? 0.8;
    this.source = this.context.createMediaElementSource(media);
    this.source.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.levels = new Uint8Array(this.analyser.fftSize);
    this.active = true;
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (!active) void this.context?.suspend();
    else void this.context?.resume();
  }

  public observePageVisibility(): () => void {
    const sync = () => this.setActive(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }

  public readLevel(): number {
    if (!this.active || !this.analyser || !this.levels) return 0;
    this.analyser.getByteTimeDomainData(this.levels);
    let sum = 0;
    for (const sample of this.levels) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    return Math.min(1, Math.sqrt(sum / this.levels.length) * 3.2);
  }

  public disconnect(): void {
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close();
    this.context = undefined;
    this.analyser = undefined;
    this.source = undefined;
    this.levels = undefined;
    this.active = false;
  }
}
