export type ClockListener = (time: Date, speed: number, playing: boolean) => void;
export class SimulationClock {
  private time: Date;
  private speed = 1440;
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<ClockListener>();
  constructor(initial = new Date()) { this.time = new Date(initial); }
  subscribe(listener: ClockListener): () => void { this.listeners.add(listener); listener(this.time, this.speed, this.playing); return () => this.listeners.delete(listener); }
  private emit(): void { for (const listener of this.listeners) listener(new Date(this.time), this.speed, this.playing); }
  play(): void { if (this.playing) return; this.playing = true; this.timer = setInterval(() => { this.time = new Date(this.time.getTime() + this.speed * 1000); this.emit(); }, 250); this.emit(); }
  pause(): void { this.playing = false; if (this.timer) clearInterval(this.timer); this.timer = null; this.emit(); }
  setSpeed(speed: number): void { this.speed = Math.min(3600, Math.max(1, speed)); this.emit(); }
  setTime(time: Date): void { this.time = new Date(time); this.emit(); }
  getState(): { time: Date; speed: number; playing: boolean } { return { time: new Date(this.time), speed: this.speed, playing: this.playing }; }
  dispose(): void { this.pause(); this.listeners.clear(); }
}
export const SPEED_OPTIONS = [1, 10, 60, 300, 900, 1440, 1800, 3600] as const;
