/**
 * Tone.js Sound Engine for CodePulse
 *
 * Provides ambient soundscapes, alert tones, event sounds, and transition
 * effects that respond to system health state.
 */
import * as Tone from "tone";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SystemHealth = "green" | "yellow" | "red";
export type Category = "alerts" | "ambience" | "events" | "transitions";
export type AlertType =
  | "approval"
  | "escalation"
  | "healingFailed"
  | "contextOverflow"
  | "securityPing"
  | "errorSpike";
export type EventType =
  | "toolTick"
  | "agentSpawn"
  | "agentComplete"
  | "compaction"
  | "flush"
  | "failover"
  | "toolDiscovered";
export type TransitionType = "pageEnter" | "pageExit";
export type PresetName =
  | "forge"
  | "deepSpace"
  | "rain"
  | "serverRoom"
  | "silent"
  | "lofi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value between 0 and 1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Convert a linear 0-1 volume to decibels (Tone.js expects dB). */
function toDB(v: number): number {
  if (v <= 0) return -Infinity;
  return 20 * Math.log10(v);
}

/** Random float in range. */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// Default category volumes (linear 0-1)
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORY_VOLUMES: Record<Category, number> = {
  alerts: 0.8,
  ambience: 0.3,
  events: 0.2,
  transitions: 0.3,
};

// ---------------------------------------------------------------------------
// SoundEngine
// ---------------------------------------------------------------------------

export class SoundEngine {
  // ---- Routing ----
  private masterVolume!: Tone.Volume;
  private channels!: Record<Category, Tone.Volume>;

  // ---- State ----
  private _running = false;
  private _preset: PresetName = "forge";
  private _health: SystemHealth = "green";

  // ---- Ambient layer cleanup ----
  private ambientCleanup: (() => void) | null = null;

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async start(): Promise<void> {
    if (this._running) return;

    await Tone.start();

    this.masterVolume = new Tone.Volume(0).toDestination();

    this.channels = {
      alerts: new Tone.Volume(toDB(DEFAULT_CATEGORY_VOLUMES.alerts)).connect(
        this.masterVolume,
      ),
      ambience: new Tone.Volume(
        toDB(DEFAULT_CATEGORY_VOLUMES.ambience),
      ).connect(this.masterVolume),
      events: new Tone.Volume(toDB(DEFAULT_CATEGORY_VOLUMES.events)).connect(
        this.masterVolume,
      ),
      transitions: new Tone.Volume(
        toDB(DEFAULT_CATEGORY_VOLUMES.transitions),
      ).connect(this.masterVolume),
    };

    this._running = true;
    this.startAmbientPreset(this._preset);
  }

  stop(): void {
    if (!this._running) return;
    this.stopAmbient();

    // Dispose channels & master
    for (const ch of Object.values(this.channels)) {
      ch.dispose();
    }
    this.masterVolume.dispose();
    this._running = false;
  }

  // ===========================================================================
  // Volume controls
  // ===========================================================================

  setMasterVolume(v: number): void {
    v = clamp01(v);
    if (this._running) {
      this.masterVolume.volume.rampTo(toDB(v), 0.1);
    }
  }

  setCategoryVolume(cat: Category, v: number): void {
    v = clamp01(v);
    if (this._running && this.channels[cat]) {
      this.channels[cat].volume.rampTo(toDB(v), 0.1);
    }
  }

  // ===========================================================================
  // Health
  // ===========================================================================

  setHealth(h: SystemHealth): void {
    this._health = h;
  }

  // ===========================================================================
  // Ambient presets
  // ===========================================================================

  setAmbientPreset(preset: PresetName): void {
    this._preset = preset;
    if (this._running) {
      this.stopAmbient();
      this.startAmbientPreset(preset);
    }
  }

  get preset(): PresetName {
    return this._preset;
  }

  get running(): boolean {
    return this._running;
  }

  // ---- Private ambient management ----

  private stopAmbient(): void {
    if (this.ambientCleanup) {
      this.ambientCleanup();
      this.ambientCleanup = null;
    }
  }

  private startAmbientPreset(preset: PresetName): void {
    switch (preset) {
      case "forge":
        this.ambientCleanup = this.buildForge();
        break;
      case "deepSpace":
        this.ambientCleanup = this.buildDeepSpace();
        break;
      case "rain":
        this.ambientCleanup = this.buildRain();
        break;
      case "serverRoom":
        this.ambientCleanup = this.buildServerRoom();
        break;
      case "silent":
        this.ambientCleanup = null;
        break;
      case "lofi":
        this.ambientCleanup = this.buildLofi();
        break;
    }
  }

  // ---- Forge (default) ----
  private buildForge(): () => void {
    const dest = this.channels.ambience;

    // Brown noise crackle
    const noise = new Tone.Noise("brown").connect(dest);
    noise.volume.value = -20;
    noise.start();

    // 60 Hz wind drone
    const drone = new Tone.Oscillator(60, "sine").connect(dest);
    drone.volume.value = -24;
    drone.start();

    // Metal hammer hits on a random loop (3-8s)
    const metal = new Tone.MetalSynth({
      envelope: { attack: 0.002, decay: 0.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 2000,
      octaves: 1.5,
    }).connect(dest);
    metal.frequency.setValueAtTime(80, Tone.now());
    metal.volume.value = -18;

    let hammerTimeout: ReturnType<typeof setTimeout>;
    const scheduleHammer = () => {
      if (!this._running || this._preset !== "forge") return;
      metal.triggerAttackRelease("C2", "8n");
      hammerTimeout = setTimeout(scheduleHammer, rand(3000, 8000));
    };
    hammerTimeout = setTimeout(scheduleHammer, rand(1000, 3000));

    return () => {
      clearTimeout(hammerTimeout);
      noise.stop();
      noise.dispose();
      drone.stop();
      drone.dispose();
      metal.dispose();
    };
  }

  // ---- Deep Space ----
  private buildDeepSpace(): () => void {
    const dest = this.channels.ambience;

    // 40 Hz pad
    const pad = new Tone.Oscillator(40, "sine").connect(dest);
    pad.volume.value = -26;
    pad.start();

    // Occasional synth ping (10-30s)
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 1.5, sustain: 0, release: 2 },
    }).connect(dest);
    synth.volume.value = -20;

    let pingTimeout: ReturnType<typeof setTimeout>;
    const schedulePing = () => {
      if (!this._running || this._preset !== "deepSpace") return;
      const note = ["C5", "E5", "G5", "B5"][Math.floor(Math.random() * 4)];
      synth.triggerAttackRelease(note, "4n");
      pingTimeout = setTimeout(schedulePing, rand(10000, 30000));
    };
    pingTimeout = setTimeout(schedulePing, rand(5000, 15000));

    return () => {
      clearTimeout(pingTimeout);
      pad.stop();
      pad.dispose();
      synth.dispose();
    };
  }

  // ---- Rain ----
  private buildRain(): () => void {
    const dest = this.channels.ambience;

    // Brown noise rain
    const rain = new Tone.Noise("brown").connect(dest);
    rain.volume.value = -16;
    rain.start();

    // Low rumble oscillator on random timer
    const rumble = new Tone.Oscillator(35, "sine").connect(dest);
    rumble.volume.value = -30;
    rumble.start();

    let rumbleTimeout: ReturnType<typeof setTimeout>;
    const scheduleRumble = () => {
      if (!this._running || this._preset !== "rain") return;
      rumble.volume.rampTo(-18, 1);
      setTimeout(() => {
        if (this._running && this._preset === "rain") {
          rumble.volume.rampTo(-30, 2);
        }
      }, 1500);
      rumbleTimeout = setTimeout(scheduleRumble, rand(8000, 20000));
    };
    rumbleTimeout = setTimeout(scheduleRumble, rand(3000, 8000));

    // Drip synth
    const drip = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    }).connect(dest);
    drip.volume.value = -14;

    let dripTimeout: ReturnType<typeof setTimeout>;
    const scheduleDrip = () => {
      if (!this._running || this._preset !== "rain") return;
      const note = ["C6", "D6", "E6", "G6"][Math.floor(Math.random() * 4)];
      drip.triggerAttackRelease(note, "32n");
      dripTimeout = setTimeout(scheduleDrip, rand(2000, 6000));
    };
    dripTimeout = setTimeout(scheduleDrip, rand(1000, 4000));

    return () => {
      clearTimeout(rumbleTimeout);
      clearTimeout(dripTimeout);
      rain.stop();
      rain.dispose();
      rumble.stop();
      rumble.dispose();
      drip.dispose();
    };
  }

  // ---- Server Room ----
  private buildServerRoom(): () => void {
    const dest = this.channels.ambience;

    // Pink noise fan hum
    const fan = new Tone.Noise("pink").connect(dest);
    fan.volume.value = -18;
    fan.start();

    // 50 Hz hum
    const hum = new Tone.Oscillator(50, "sine").connect(dest);
    hum.volume.value = -28;
    hum.start();

    // Click pattern loop
    const click = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.02, release: 0.01 },
      harmonicity: 0.1,
      modulationIndex: 2,
      resonance: 1000,
      octaves: 0.5,
    }).connect(dest);
    click.frequency.setValueAtTime(400, Tone.now());
    click.volume.value = -22;

    let clickTimeout: ReturnType<typeof setTimeout>;
    const scheduleClick = () => {
      if (!this._running || this._preset !== "serverRoom") return;
      click.triggerAttackRelease("C4", "64n");
      clickTimeout = setTimeout(scheduleClick, rand(500, 2000));
    };
    clickTimeout = setTimeout(scheduleClick, rand(200, 800));

    return () => {
      clearTimeout(clickTimeout);
      fan.stop();
      fan.dispose();
      hum.stop();
      hum.dispose();
      click.dispose();
    };
  }

  // ---- Lo-fi ----
  private buildLofi(): () => void {
    const dest = this.channels.ambience;

    // Vinyl crackle (white noise very low)
    const vinyl = new Tone.Noise("white").connect(dest);
    vinyl.volume.value = -36;
    vinyl.start();

    // Lo-fi beat at ~70 BPM (interval ~857ms)
    const bpm = 70;
    const beatInterval = (60 / bpm) * 1000;

    // Kick (MembraneSynth)
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(dest);
    kick.volume.value = -12;

    // Snare (NoiseSynth)
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(dest);
    snare.volume.value = -16;

    // Hi-hat (MetalSynth)
    const hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(dest);
    hihat.frequency.setValueAtTime(300, Tone.now());
    hihat.volume.value = -20;

    // Bass synth
    const bass = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.2 },
    }).connect(dest);
    bass.volume.value = -14;

    const bassNotes = ["C2", "E2", "G2", "A2", "C3"];
    let beat = 0;
    let loopTimeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!this._running || this._preset !== "lofi") return;
      const step = beat % 8;

      // Kick on 1, 5
      if (step === 0 || step === 4) {
        kick.triggerAttackRelease("C1", "8n");
      }
      // Snare on 3, 7
      if (step === 2 || step === 6) {
        snare.triggerAttackRelease("8n");
      }
      // Hi-hat on every beat
      hihat.triggerAttackRelease("C4", "32n");

      // Bass on 1, 3, 5, 7
      if (step % 2 === 0) {
        const note = bassNotes[Math.floor(Math.random() * bassNotes.length)];
        bass.triggerAttackRelease(note, "8n");
      }

      beat++;
      loopTimeout = setTimeout(tick, beatInterval / 2); // eighth note grid
    };
    loopTimeout = setTimeout(tick, 500);

    return () => {
      clearTimeout(loopTimeout);
      vinyl.stop();
      vinyl.dispose();
      kick.dispose();
      snare.dispose();
      hihat.dispose();
      bass.dispose();
    };
  }

  // ===========================================================================
  // Alerts (6)
  // ===========================================================================

  playAlert(type: AlertType): void {
    if (!this._running) return;
    switch (type) {
      case "approval":
        this.playApprovalChime();
        break;
      case "escalation":
        this.playEscalation();
        break;
      case "healingFailed":
        this.playHealingFailed();
        break;
      case "contextOverflow":
        this.playContextOverflow();
        break;
      case "securityPing":
        this.playSecurityPing();
        break;
      case "errorSpike":
        this.playErrorSpike();
        break;
    }
  }

  /** C5 -> E5 -> G5 staccato burst */
  private playApprovalChime(): void {
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 },
    }).connect(this.channels.alerts);
    synth.volume.value = -6;

    const now = Tone.now();
    synth.triggerAttackRelease("C5", "32n", now);
    synth.triggerAttackRelease("E5", "32n", now + 0.08);
    synth.triggerAttackRelease("G5", "32n", now + 0.16);
    setTimeout(() => synth.dispose(), 1000);
  }

  /** C4 -> E4 -> G4 -> C5 arpeggio + reverb */
  private playEscalation(): void {
    const reverb = new Tone.Reverb({ decay: 2, wet: 0.4 }).connect(
      this.channels.alerts,
    );
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
    }).connect(reverb);
    synth.volume.value = -6;

    const now = Tone.now();
    synth.triggerAttackRelease("C4", "8n", now);
    synth.triggerAttackRelease("E4", "8n", now + 0.12);
    synth.triggerAttackRelease("G4", "8n", now + 0.24);
    synth.triggerAttackRelease("C5", "8n", now + 0.36);
    setTimeout(() => {
      synth.dispose();
      reverb.dispose();
    }, 3000);
  }

  /** E4 -> C4 descending minor 3rd, distorted */
  private playHealingFailed(): void {
    const dist = new Tone.Distortion(0.6).connect(this.channels.alerts);
    const synth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
    }).connect(dist);
    synth.volume.value = -10;

    const now = Tone.now();
    synth.triggerAttackRelease("E4", "8n", now);
    synth.triggerAttackRelease("C4", "8n", now + 0.2);
    setTimeout(() => {
      synth.dispose();
      dist.dispose();
    }, 2000);
  }

  /** 50 Hz + 100 Hz swell, 2s duration */
  private playContextOverflow(): void {
    const dest = this.channels.alerts;

    const osc1 = new Tone.Oscillator(50, "sine").connect(dest);
    const osc2 = new Tone.Oscillator(100, "sawtooth").connect(dest);
    osc1.volume.value = -30;
    osc2.volume.value = -30;

    osc1.start();
    osc2.start();
    osc1.volume.rampTo(-8, 1);
    osc2.volume.rampTo(-12, 1);

    setTimeout(() => {
      osc1.volume.rampTo(-60, 0.8);
      osc2.volume.rampTo(-60, 0.8);
    }, 1200);

    setTimeout(() => {
      osc1.stop();
      osc1.dispose();
      osc2.stop();
      osc2.dispose();
    }, 2500);
  }

  /** 2 kHz metallic ping, 50 ms attack */
  private playSecurityPing(): void {
    const metal = new Tone.MetalSynth({
      envelope: { attack: 0.05, decay: 0.2, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 1,
    }).connect(this.channels.alerts);
    metal.frequency.setValueAtTime(2000, Tone.now());
    metal.volume.value = -8;

    metal.triggerAttackRelease("C4", "16n");
    setTimeout(() => metal.dispose(), 1000);
  }

  /** FM warble, 400 Hz carrier, 6 Hz mod */
  private playErrorSpike(): void {
    const fm = new Tone.FMSynth({
      harmonicity: 6 / 400,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.1, release: 0.3 },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        release: 0.2,
      },
    }).connect(this.channels.alerts);
    fm.volume.value = -8;

    fm.triggerAttackRelease(400, "4n");
    setTimeout(() => fm.dispose(), 2000);
  }

  // ===========================================================================
  // Events (7)
  // ===========================================================================

  playEvent(type: EventType): void {
    if (!this._running) return;
    switch (type) {
      case "toolTick":
        this.playToolTick();
        break;
      case "agentSpawn":
        this.playAgentSpawn();
        break;
      case "agentComplete":
        this.playAgentComplete();
        break;
      case "compaction":
        this.playCompaction();
        break;
      case "flush":
        this.playFlush();
        break;
      case "failover":
        this.playFailover();
        break;
      case "toolDiscovered":
        this.playToolDiscovered();
        break;
    }
  }

  /** 5 ms soft tick */
  private playToolTick(): void {
    const metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.005, release: 0.005 },
      harmonicity: 0.1,
      modulationIndex: 2,
      resonance: 800,
      octaves: 0.5,
    }).connect(this.channels.events);
    metal.frequency.setValueAtTime(400, Tone.now());
    metal.volume.value = -28;

    metal.triggerAttackRelease("C4", "128n");
    setTimeout(() => metal.dispose(), 200);
  }

  /** Filtered white noise rising, 200 ms */
  private playAgentSpawn(): void {
    const filter = new Tone.Filter({
      frequency: 200,
      type: "lowpass",
      rolloff: -24,
    }).connect(this.channels.events);
    const noise = new Tone.Noise("white").connect(filter);
    noise.volume.value = -14;

    noise.start();
    filter.frequency.rampTo(4000, 0.2);
    noise.volume.rampTo(-40, 0.2);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
    }, 400);
  }

  /** 880 Hz sine, 100 ms fade */
  private playAgentComplete(): void {
    const osc = new Tone.Oscillator(880, "sine").connect(this.channels.events);
    osc.volume.value = -12;
    osc.start();
    osc.volume.rampTo(-60, 0.1);

    setTimeout(() => {
      osc.stop();
      osc.dispose();
    }, 300);
  }

  /** Filtered noise low-pass sweep, 1s */
  private playCompaction(): void {
    const filter = new Tone.Filter({
      frequency: 4000,
      type: "lowpass",
      rolloff: -24,
    }).connect(this.channels.events);
    const noise = new Tone.Noise("brown").connect(filter);
    noise.volume.value = -14;

    noise.start();
    filter.frequency.rampTo(100, 1);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
    }, 1200);
  }

  /** Pentatonic crystalline arpeggio, 500 ms */
  private playFlush(): void {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 },
    }).connect(this.channels.events);
    synth.volume.value = -10;

    const notes = ["C6", "D6", "E6", "G6", "A6"];
    const now = Tone.now();
    notes.forEach((n, i) => {
      synth.triggerAttackRelease(n, "64n", now + i * 0.09);
    });
    setTimeout(() => synth.dispose(), 1000);
  }

  /** 300 -> 200 Hz descending + recovery rise */
  private playFailover(): void {
    const synth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.3 },
    }).connect(this.channels.events);
    synth.volume.value = -10;

    const now = Tone.now();
    synth.triggerAttack(300, now);
    synth.frequency.rampTo(200, 0.3);
    synth.triggerRelease(now + 0.4);

    // Recovery rise
    setTimeout(() => {
      if (!this._running) return;
      synth.triggerAttack(200, Tone.now());
      synth.frequency.rampTo(400, 0.3);
      synth.triggerRelease(Tone.now() + 0.35);
    }, 500);

    setTimeout(() => synth.dispose(), 2000);
  }

  /** High harmonics sparkle, 50 ms */
  private playToolDiscovered(): void {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 },
    }).connect(this.channels.events);
    synth.volume.value = -8;

    const now = Tone.now();
    synth.triggerAttackRelease("C7", "128n", now);
    synth.triggerAttackRelease("E7", "128n", now + 0.025);
    setTimeout(() => synth.dispose(), 500);
  }

  // ===========================================================================
  // Transitions (2)
  // ===========================================================================

  playTransition(type: TransitionType): void {
    if (!this._running) return;
    switch (type) {
      case "pageEnter":
        this.playPageEnter();
        break;
      case "pageExit":
        this.playPageExit();
        break;
    }
  }

  /** Soft rising whoosh */
  private playPageEnter(): void {
    const filter = new Tone.Filter({
      frequency: 200,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.channels.transitions);
    const noise = new Tone.Noise("pink").connect(filter);
    noise.volume.value = -18;

    noise.start();
    filter.frequency.rampTo(3000, 0.3);
    noise.volume.rampTo(-40, 0.3);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
    }, 500);
  }

  /** Soft falling whoosh */
  private playPageExit(): void {
    const filter = new Tone.Filter({
      frequency: 3000,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.channels.transitions);
    const noise = new Tone.Noise("pink").connect(filter);
    noise.volume.value = -18;

    noise.start();
    filter.frequency.rampTo(100, 0.3);
    noise.volume.rampTo(-40, 0.3);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
    }, 500);
  }
}

export default SoundEngine;
