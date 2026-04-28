import type { ClockDivision } from "./MasterClock";
import { masterClock } from "./MasterClock";

const DIV_MULT: Record<ClockDivision, number> = {
  "1/1":  0.25,
  "1/2":  0.5,
  "1/4":  1,
  "1/8":  2,
  "1/16": 4,
  "1/4T": 4 / 3,
  "1/8T": 8 / 3,
};

export interface DeckState {
  /** Bundled-sample slug (or null if no sample loaded). */
  sampleSlug: string | null;
  /** Clock division this deck triggers on. */
  division: ClockDivision;
  /** Linear gain 0..1.5. */
  gain: number;
  /** Pan –1..+1. */
  pan: number;
  /** Highpass cutoff 20–8000 Hz (20 ≈ off). */
  hpfFreq: number;
  /** Lowpass cutoff 200–20000 Hz (20000 ≈ off). */
  lpfFreq: number;
  /** Drive amount 0..1 (tanh waveshaper). */
  drive: number;
  /** Send to master delay 0..1. */
  delaySend: number;
  /** Send to master reverb 0..1. */
  reverbSend: number;
  /** Probability that any given step plays 0..1. */
  probability: number;
  /** Swing 0..0.5 (offsets odd steps). */
  swing: number;
  /** Pitch in semitones –24..+24. */
  pitch: number;
  /** Mute flag. */
  mute: boolean;
  /** Solo flag (any solo silences non-solo decks). */
  solo: boolean;
  /** Whether this deck triggers at all. */
  active: boolean;
  /** Reverse playback. */
  reverse: boolean;
}

export function defaultDeckState(idx: number): DeckState {
  // Reasonable starter palette — kick / clap / hat / atmosphere
  const slugs = ["techno-kick", "clap", "closed-hat", "noise-riser"];
  const divs: ClockDivision[] = ["1/4", "1/4", "1/8", "1/2"];
  return {
    sampleSlug: slugs[idx] ?? null,
    division: divs[idx] ?? "1/4",
    gain: 0.8,
    pan: 0,
    hpfFreq: 20,
    lpfFreq: 20000,
    drive: 0,
    delaySend: 0,
    reverbSend: 0,
    probability: 1,
    swing: 0,
    pitch: 0,
    mute: false,
    solo: false,
    active: idx === 0,   // only deck 1 active by default — user opts in to layers
    reverse: false,
  };
}

/** Drive curve: 2k-sample tanh waveshaper, normalized. */
function makeDriveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount * 30 + 0.01;
  const norm = Math.tanh(k) || 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

interface ChunkState {
  nextTime: number;
}

/**
 * A single sample deck. Owns its per-deck FX chain (hpf → lpf → drive → pan →
 * gain) and three output taps:
 *   - dryOut → master FX input
 *   - delaySendOut → master delay input
 *   - reverbSendOut → master reverb input
 *
 * Pulses are scheduled by the host engine via scheduleChunk(); each pulse
 * spawns a fresh BufferSource with a short envelope.
 */
export class SampleDeck {
  readonly ctx: AudioContext;
  readonly index: number;

  // Output taps — host wires these to their destinations.
  readonly dryOut: GainNode;
  readonly delaySendOut: GainNode;
  readonly reverbSendOut: GainNode;

  // Per-deck FX chain
  private readonly hpf: BiquadFilterNode;
  private readonly lpf: BiquadFilterNode;
  private readonly drive: WaveShaperNode;
  private readonly driveBypass: GainNode;
  private readonly driveWet: GainNode;
  private readonly panner: StereoPannerNode;
  private readonly gain: GainNode;

  // Internal mix → fans out to dry / delay-send / reverb-send
  private readonly fanIn: GainNode;

  private buffer: AudioBuffer | null = null;
  private state: DeckState;
  private currentDriveAmt = 0;

  constructor(ctx: AudioContext, index: number, state: DeckState) {
    this.ctx = ctx;
    this.index = index;
    this.state = { ...state };

    this.hpf = ctx.createBiquadFilter();
    this.hpf.type = "highpass";
    this.hpf.frequency.value = state.hpfFreq;
    this.hpf.Q.value = 0.707;

    this.lpf = ctx.createBiquadFilter();
    this.lpf.type = "lowpass";
    this.lpf.frequency.value = state.lpfFreq;
    this.lpf.Q.value = 0.707;

    this.drive = ctx.createWaveShaper();
    this.drive.curve = makeDriveCurve(state.drive);
    this.drive.oversample = "2x";
    this.currentDriveAmt = state.drive;
    this.driveBypass = ctx.createGain();
    this.driveBypass.gain.value = state.drive > 0.001 ? 0 : 1;
    this.driveWet = ctx.createGain();
    this.driveWet.gain.value = state.drive > 0.001 ? 1 : 0;

    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = state.pan;

    this.gain = ctx.createGain();
    this.gain.gain.value = this.effectiveGain();

    this.fanIn = ctx.createGain();
    this.fanIn.gain.value = 1;

    this.dryOut = ctx.createGain();
    this.dryOut.gain.value = 1;
    this.delaySendOut = ctx.createGain();
    this.delaySendOut.gain.value = state.delaySend;
    this.reverbSendOut = ctx.createGain();
    this.reverbSendOut.gain.value = state.reverbSend;

    // hpf → lpf → (drive | bypass) → panner → gain → fanIn → {dry, dlySend, revSend}
    this.hpf.connect(this.lpf);
    this.lpf.connect(this.drive);
    this.drive.connect(this.driveWet);
    this.lpf.connect(this.driveBypass);
    this.driveWet.connect(this.panner);
    this.driveBypass.connect(this.panner);
    this.panner.connect(this.gain);
    this.gain.connect(this.fanIn);
    this.fanIn.connect(this.dryOut);
    this.fanIn.connect(this.delaySendOut);
    this.fanIn.connect(this.reverbSendOut);
  }

  setBuffer(buf: AudioBuffer | null) {
    this.buffer = buf;
  }

  /** Update the deck's effective state. Smooth ramps for audio params. */
  applyState(state: DeckState, anySolo: boolean) {
    const t = this.ctx.currentTime;
    const TC = 0.012;
    this.state = { ...state };

    this.hpf.frequency.setTargetAtTime(state.hpfFreq, t, TC);
    this.lpf.frequency.setTargetAtTime(state.lpfFreq, t, TC);
    this.panner.pan.setTargetAtTime(state.pan, t, TC);

    if (Math.abs(state.drive - this.currentDriveAmt) > 0.001) {
      this.drive.curve = makeDriveCurve(state.drive);
      this.currentDriveAmt = state.drive;
    }
    if (state.drive > 0.001) {
      this.driveWet.gain.setTargetAtTime(1, t, TC);
      this.driveBypass.gain.setTargetAtTime(0, t, TC);
    } else {
      this.driveWet.gain.setTargetAtTime(0, t, TC);
      this.driveBypass.gain.setTargetAtTime(1, t, TC);
    }

    this.delaySendOut.gain.setTargetAtTime(state.delaySend, t, TC);
    this.reverbSendOut.gain.setTargetAtTime(state.reverbSend, t, TC);

    this.gain.gain.setTargetAtTime(this.computeEffectiveGain(state, anySolo), t, TC);
  }

  private effectiveGain(): number {
    return this.computeEffectiveGain(this.state, false);
  }

  private computeEffectiveGain(state: DeckState, anySolo: boolean): number {
    if (!state.active) return 0;
    if (state.mute) return 0;
    // If any deck is soloing, only the soloed deck(s) are audible.
    if (anySolo && !state.solo) return 0;
    return Math.max(0, Math.min(1.5, state.gain));
  }

  /**
   * Schedule deck triggers between chunkStart and chunkStart+chunkDur.
   * Returns the next-trigger time (carried across chunks).
   */
  scheduleChunk(
    chunkStart: number,
    chunkDur: number,
    state: ChunkState,
    bpm: number,
  ): ChunkState {
    if (!this.buffer || !this.state.active) return state;

    const stepDur = 1 / ((bpm / 60) * DIV_MULT[this.state.division]);
    if (stepDur <= 0 || !isFinite(stepDur)) return state;

    const swing = Math.max(0, Math.min(0.5, this.state.swing));
    const prob = Math.max(0, Math.min(1, this.state.probability));
    const chunkEnd = chunkStart + chunkDur;
    let next = state.nextTime;
    let stepIdx = Math.round(next / stepDur);

    while (next < chunkEnd) {
      const odd = stepIdx % 2 === 1;
      const swung = odd ? next + stepDur * swing * 0.5 : next;
      if (swung < chunkEnd && (prob >= 1 || Math.random() < prob)) {
        this.schedulePulseAt(swung);
      }
      next += stepDur;
      stepIdx++;
    }
    return { nextTime: next };
  }

  /** Spawn a one-shot BufferSource with a short envelope. */
  private schedulePulseAt(t: number) {
    if (!this.buffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    if (this.state.reverse) {
      // BufferSource doesn't natively reverse — clone and reverse-iterate.
      const buf = this.buffer;
      const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const s = buf.getChannelData(ch);
        const d = rev.getChannelData(ch);
        for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i];
      }
      src.buffer = rev;
    }
    const semitones = this.state.pitch;
    src.playbackRate.value = Math.pow(2, semitones / 12);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.003);

    src.connect(env);
    env.connect(this.hpf);

    src.start(t);
    const dur = (this.buffer.duration / src.playbackRate.value) + 0.05;
    src.stop(t + dur);
    src.onended = () => {
      try { src.disconnect(); env.disconnect(); } catch { /* noop */ }
    };
  }

  destroy() {
    try {
      this.hpf.disconnect();
      this.lpf.disconnect();
      this.drive.disconnect();
      this.driveBypass.disconnect();
      this.driveWet.disconnect();
      this.panner.disconnect();
      this.gain.disconnect();
      this.fanIn.disconnect();
      this.dryOut.disconnect();
      this.delaySendOut.disconnect();
      this.reverbSendOut.disconnect();
    } catch { /* noop */ }
  }
}

/** Reset chunk state at start of playback. */
export function newDeckChunkState(startTime: number, division: ClockDivision, bpm: number) {
  const stepDur = 1 / ((bpm / 60) * DIV_MULT[division]);
  // Snap first trigger to the next step on the global grid so multiple decks
  // started at slightly different times still align.
  const grid = Math.ceil(startTime / stepDur) * stepDur;
  return { nextTime: grid };
}

/** Convenience: number of seconds per division at given BPM. */
export function divisionSeconds(div: ClockDivision, bpm: number = masterClock.bpm): number {
  return 1 / ((bpm / 60) * DIV_MULT[div]);
}
