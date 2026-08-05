import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Counter lives in a hoisted block because vi.mock factories are hoisted above
// every other statement in the file.
const toneMock = vi.hoisted(() => ({ loads: 0 }));

vi.mock("tone", () => {
  // Incremented once per real evaluation of the module. If audioEngine.ts ever
  // goes back to a module-level static import, this fires at import time --
  // which is exactly what the first test below asserts must not happen.
  toneMock.loads++;

  class FakeParam {
    value = 0;
    rampTo = vi.fn();
    setValueAtTime = vi.fn();
  }
  class FakeNode {
    volume = new FakeParam();
    frequency = new FakeParam();
    connect = vi.fn(() => this);
    toDestination = vi.fn(() => this);
    dispose = vi.fn();
    start = vi.fn(() => this);
    stop = vi.fn(() => this);
    triggerAttack = vi.fn();
    triggerRelease = vi.fn();
    triggerAttackRelease = vi.fn();
  }

  return {
    start: vi.fn(async () => {}),
    now: vi.fn(() => 0),
    Volume: FakeNode,
    Noise: FakeNode,
    Oscillator: FakeNode,
    Synth: FakeNode,
    MetalSynth: FakeNode,
    MembraneSynth: FakeNode,
    NoiseSynth: FakeNode,
    FMSynth: FakeNode,
    Filter: FakeNode,
    Reverb: FakeNode,
    Distortion: FakeNode,
  };
});

// A plain static import of the engine. If the engine itself statically imported
// the synthesis library, this line alone would evaluate it.
import SoundEngine, { loadTone } from "./audioEngine";

describe("audioEngine deferred synthesis-library load (DEBT-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not evaluate the synthesis library at module-evaluation time", () => {
    // SoundEngine is imported above and constructed here -- neither may touch
    // the library. Only an explicit init is allowed to.
    const engine = new SoundEngine();
    expect(engine.running).toBe(false);
    expect(toneMock.loads).toBe(0);
  });

  it("loads the library exactly once, on init", async () => {
    expect(toneMock.loads).toBe(0);
    const engine = new SoundEngine();
    await engine.start();
    expect(toneMock.loads).toBe(1);
    expect(engine.running).toBe(true);
    engine.stop();
  });

  it("hands back the identical promise on repeated loads (memoised)", async () => {
    const first = loadTone();
    const second = loadTone();
    // Identity, not equality: `import()` returns a fresh promise on every call
    // even when the module itself is already cached, so a non-memoised loader
    // would hand back two distinct objects here.
    expect(first).toBe(second);
    await expect(first).resolves.toBeDefined();
  });

  it("loads the library once across two separate engine inits", async () => {
    const a = new SoundEngine();
    await a.start();
    a.stop();

    const b = new SoundEngine();
    await b.start();
    b.stop();

    expect(toneMock.loads).toBe(1);
  });

  it("surfaces a rejected library start instead of swallowing it", async () => {
    const tone = await import("tone");
    vi.mocked(tone.start).mockRejectedValueOnce(new Error("no user gesture"));

    const engine = new SoundEngine();
    await expect(engine.start()).rejects.toThrow("no user gesture");
    // A failed init must leave the engine stopped, not half-running.
    expect(engine.running).toBe(false);
  });
});

describe("audioEngine load failure (DEBT-03)", () => {
  afterEach(() => {
    vi.doUnmock("tone");
    vi.resetModules();
  });

  it("propagates a failed dynamic import to the caller", async () => {
    vi.resetModules();
    vi.doMock("tone", () => {
      throw new Error("chunk load failed");
    });

    const mod = await import("./audioEngine");
    const engine = new mod.default();

    // Assert on the loader itself first. `engine.start()` alone is not a guard
    // here: a loader that swallowed the failure and resolved to an empty module
    // would still make start() reject, just with a downstream TypeError on the
    // missing Tone.start -- so the engine-level assertion below passes for the
    // wrong reason unless this one pins the loader's own behaviour.
    await expect(mod.loadTone()).rejects.toThrow();

    // Asserted as "rejects at all" rather than on the message: vitest wraps a
    // throwing mock factory in its own error, so the text belongs to the test
    // harness, not to the engine. What matters is that the failure reaches the
    // caller instead of being swallowed into a silent no-op.
    await expect(engine.start()).rejects.toThrow();
    expect(engine.running).toBe(false);
  });

  it("does not memoise a failed load, so a later init can still succeed", async () => {
    vi.resetModules();
    let shouldFail = true;
    vi.doMock("tone", () => {
      if (shouldFail) throw new Error("chunk load failed");
      class FakeParam {
        value = 0;
        rampTo = vi.fn();
        setValueAtTime = vi.fn();
      }
      class FakeNode {
        volume = new FakeParam();
        frequency = new FakeParam();
        connect = vi.fn(() => this);
        toDestination = vi.fn(() => this);
        dispose = vi.fn();
        start = vi.fn(() => this);
        stop = vi.fn(() => this);
        triggerAttackRelease = vi.fn();
      }
      return {
        start: vi.fn(async () => {}),
        now: vi.fn(() => 0),
        Volume: FakeNode,
        Noise: FakeNode,
        Oscillator: FakeNode,
        Synth: FakeNode,
        MetalSynth: FakeNode,
      };
    });

    const mod = await import("./audioEngine");
    await expect(mod.loadTone()).rejects.toThrow();

    shouldFail = false;
    vi.resetModules();
    await expect(mod.loadTone()).resolves.toBeDefined();
  });
});
