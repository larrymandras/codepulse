/**
 * Ambient Audio Engine — Web Audio API generative soundscape
 *
 * Creates a subtle atmospheric drone that responds to system health:
 * - Green: warm consonant tones (major third)
 * - Yellow: slightly tense (minor third)
 * - Red: dissonant undertone (tritone)
 *
 * Very quiet by design — meant to sit below conscious awareness.
 */

export type SystemHealth = "green" | "yellow" | "red";

const HEALTH_FREQUENCIES: Record<SystemHealth, { base: number; harmonic: number }> = {
  green: { base: 55, harmonic: 69.3 },   // A1 + C#2 (major 3rd)
  yellow: { base: 55, harmonic: 65.4 },   // A1 + C2  (minor 3rd)
  red: { base: 55, harmonic: 77.8 },      // A1 + D#2 (tritone)
};

export class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private harmonicOsc: OscillatorNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private pulseOsc: OscillatorNode | null = null;
  private pulseGain: GainNode | null = null;
  private _volume = 0.08;
  private _health: SystemHealth = "green";
  private _running = false;

  get running() {
    return this._running;
  }

  get volume() {
    return this._volume;
  }

  start() {
    if (this._running) return;

    this.ctx = new AudioContext();
    const now = this.ctx.currentTime;

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this._volume, now);
    this.masterGain.connect(this.ctx.destination);

    // LFO for gentle amplitude modulation
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.setValueAtTime(0.08, now); // very slow
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(0.02, now);
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.masterGain.gain);
    this.lfo.start(now);

    // Base drone
    const freqs = HEALTH_FREQUENCIES[this._health];
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = "sine";
    this.droneOsc.frequency.setValueAtTime(freqs.base, now);
    this.droneOsc.connect(this.masterGain);
    this.droneOsc.start(now);

    // Harmonic
    this.harmonicOsc = this.ctx.createOscillator();
    this.harmonicOsc.type = "sine";
    this.harmonicOsc.frequency.setValueAtTime(freqs.harmonic, now);
    const harmonicGain = this.ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.4, now);
    this.harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(this.masterGain);
    this.harmonicOsc.start(now);

    // Pulse oscillator (silent until triggered)
    this.pulseOsc = this.ctx.createOscillator();
    this.pulseOsc.type = "triangle";
    this.pulseOsc.frequency.setValueAtTime(440, now);
    this.pulseGain = this.ctx.createGain();
    this.pulseGain.gain.setValueAtTime(0, now);
    this.pulseOsc.connect(this.pulseGain);
    this.pulseGain.connect(this.masterGain);
    this.pulseOsc.start(now);

    this._running = true;
  }

  stop() {
    if (!this._running || !this.ctx) return;

    this.droneOsc?.stop();
    this.harmonicOsc?.stop();
    this.lfo?.stop();
    this.pulseOsc?.stop();
    this.ctx.close();
    this.ctx = null;
    this._running = false;
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.1);
    }
  }

  setHealth(health: SystemHealth) {
    if (health === this._health) return;
    this._health = health;
    if (!this.ctx || !this.droneOsc || !this.harmonicOsc) return;

    const freqs = HEALTH_FREQUENCIES[health];
    const now = this.ctx.currentTime;
    this.droneOsc.frequency.setTargetAtTime(freqs.base, now, 0.5);
    this.harmonicOsc.frequency.setTargetAtTime(freqs.harmonic, now, 0.5);
  }

  /** Trigger a brief chime — call when events arrive */
  pulse(pitch: number = 440) {
    if (!this.ctx || !this.pulseGain || !this.pulseOsc) return;
    const now = this.ctx.currentTime;
    this.pulseOsc.frequency.setValueAtTime(pitch, now);
    this.pulseGain.gain.setValueAtTime(0.15, now);
    this.pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  }

  /** Alert chime — two-tone descending */
  alertChime() {
    if (!this.ctx || !this.pulseGain || !this.pulseOsc) return;
    const now = this.ctx.currentTime;
    this.pulseOsc.frequency.setValueAtTime(660, now);
    this.pulseGain.gain.setValueAtTime(0.2, now);
    this.pulseOsc.frequency.setValueAtTime(440, now + 0.15);
    this.pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  }
}
