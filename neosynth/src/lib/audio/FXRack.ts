import type { ClockDivision } from "./MasterClock";

const DIVISION_MULTIPLIERS: Record<ClockDivision, number> = {
  "1/1":  0.25,
  "1/2":  0.5,
  "1/4":  1,
  "1/8":  2,
  "1/16": 4,
  "1/4T": 4 / 3,
  "1/8T": 8 / 3,
};

function createImpulseResponse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * durationSec);
  const buf = ctx.createBuffer(2, length, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buf;
}

function makeDriveCurve(amount: number): Float32Array {
  const n = 2048;
  const curve = new Float32Array(n) as Float32Array;
  const k = amount * 40 + 0.01;
  const norm = Math.tanh(k) || 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

function makeCrushCurve(bits: number): Float32Array {
  const n = 4096;
  const curve = new Float32Array(n) as Float32Array;
  const steps = Math.max(2, Math.pow(2, bits));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

export type PadId =
  | "impact"
  | "killLow"
  | "killHigh"
  | "reverbThrow"
  | "delayThrow"
  | "drop"
  | "sweepUp"
  | "stutter";

export interface FXState {
  // Drive
  driveAmount: number;       // 0-1
  driveEnabled: boolean;
  // Filters
  hpfFreq: number;           // 20–2000 Hz
  hpfEnabled: boolean;
  lpfFreq: number;           // 200–20000 Hz
  lpfEnabled: boolean;
  // Bitcrush
  crushBits: number;         // 1–12
  crushEnabled: boolean;
  // Stereo width
  widthAmount: number;       // 0 (mono) – 2 (ultra-wide), 1 = neutral
  widthEnabled: boolean;
  // Trance gate
  gateDiv: ClockDivision;
  gateDepth: number;         // 0–1
  gateEnabled: boolean;
  // Sidechain pump
  pumpDiv: ClockDivision;
  pumpDepth: number;         // 0–1
  pumpEnabled: boolean;
  // Delay
  delayTime: number;         // 0.01–1.9 s
  delayFeedback: number;     // 0–0.95
  delayWet: number;          // 0–1
  delayEnabled: boolean;
  delaySync: ClockDivision | null;
  // Reverb
  reverbWet: number;         // 0–1
  reverbSize: number;        // 0.5–5 s
  reverbEnabled: boolean;
  // Master
  masterGain: number;        // 0–1.5
  limiterEnabled: boolean;
}

export const DEFAULT_FX_STATE: FXState = {
  driveAmount: 0,
  driveEnabled: false,
  hpfFreq: 20,
  hpfEnabled: false,
  lpfFreq: 18000,
  lpfEnabled: false,
  crushBits: 12,
  crushEnabled: false,
  widthAmount: 1,
  widthEnabled: false,
  gateDiv: "1/16",
  gateDepth: 1,
  gateEnabled: false,
  pumpDiv: "1/4",
  pumpDepth: 0.7,
  pumpEnabled: false,
  delayTime: 0.375,
  delayFeedback: 0.4,
  delayWet: 0,
  delayEnabled: false,
  delaySync: "1/8",
  reverbWet: 0,
  reverbSize: 2.5,
  reverbEnabled: false,
  masterGain: 1,
  limiterEnabled: true,
};

/**
 * Signal flow:
 *   input → drive → hpf → lpf → crush → width(M/S) → busIn
 *   busIn → dry → preOut
 *          → delaySend → delay(fb) → preOut
 *          → reverbSend → convolver → preOut
 *   preOut → gate → pump → limiter → masterGain → meter(analyser) → output
 */
export class FXRack {
  readonly input: GainNode;
  readonly output: GainNode;

  // Drive / colour
  private readonly drive: WaveShaperNode;
  private readonly driveIn: GainNode;
  private readonly driveOut: GainNode;

  // Filters
  readonly hpf: BiquadFilterNode;
  readonly lpf: BiquadFilterNode;

  // Bitcrush
  private readonly crush: WaveShaperNode;

  // Stereo width (M/S)
  private readonly widthIn: GainNode;
  private readonly widthOut: GainNode;
  private readonly sideScale: GainNode;
  private readonly widthBypass: GainNode;
  private readonly widthWet: GainNode;

  // Parallel sends bus
  private readonly busIn: GainNode;
  private readonly preOut: GainNode;

  // Delay
  readonly delayNode: DelayNode;
  private readonly delayFbGain: GainNode;
  readonly delayWetGain: GainNode;

  // Reverb
  readonly convolver: ConvolverNode;
  readonly reverbWetGain: GainNode;

  // Performance bus effects
  readonly gateGain: GainNode;
  readonly pumpGain: GainNode;

  // Master
  private readonly limiter: DynamicsCompressorNode;
  readonly masterGainNode: GainNode;
  readonly meterAnalyser: AnalyserNode;
  readonly meterAnalyserL: AnalyserNode;
  readonly meterAnalyserR: AnalyserNode;

  private readonly ctx: AudioContext;
  private state: FXState;
  private currentBits = -1;
  private currentDrive = -1;

  constructor(ctx: AudioContext, state: FXState) {
    this.ctx = ctx;
    this.state = { ...state };

    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // Drive stage: gain-in → shaper → gain-out (compensate)
    this.driveIn = ctx.createGain();
    this.driveIn.gain.value = 1;
    this.drive = ctx.createWaveShaper();
    this.drive.curve = makeDriveCurve(state.driveAmount) as any;
    this.drive.oversample = "2x";
    this.currentDrive = state.driveAmount;
    this.driveOut = ctx.createGain();
    this.driveOut.gain.value = 1;

    // HPF
    this.hpf = ctx.createBiquadFilter();
    this.hpf.type = "highpass";
    this.hpf.frequency.value = state.hpfFreq;
    this.hpf.Q.value = 0.707;

    // LPF
    this.lpf = ctx.createBiquadFilter();
    this.lpf.type = "lowpass";
    this.lpf.frequency.value = state.lpfFreq;
    this.lpf.Q.value = 0.707;

    // Bitcrush
    this.crush = ctx.createWaveShaper();
    this.crush.curve = makeCrushCurve(state.crushBits) as any;
    this.crush.oversample = "none";
    this.currentBits = state.crushBits;

    // Stereo width (M/S)
    // Pre: split L,R; mid = (L+R)/2; side = (L-R)/2; scale side; rebuild L=M+S, R=M-S
    this.widthIn = ctx.createGain();
    this.widthOut = ctx.createGain();
    this.widthBypass = ctx.createGain();
    this.widthBypass.gain.value = state.widthEnabled ? 0 : 1;
    this.widthWet = ctx.createGain();
    this.widthWet.gain.value = state.widthEnabled ? 1 : 0;

    const splitter = ctx.createChannelSplitter(2);
    const midL = ctx.createGain(); midL.gain.value = 0.5;
    const midR = ctx.createGain(); midR.gain.value = 0.5;
    const sideL = ctx.createGain(); sideL.gain.value = 0.5;
    const sideRneg = ctx.createGain(); sideRneg.gain.value = -0.5;
    const midSum = ctx.createGain();
    const sideSum = ctx.createGain();
    this.sideScale = ctx.createGain();
    this.sideScale.gain.value = state.widthAmount;
    const sideNeg = ctx.createGain(); sideNeg.gain.value = -1;
    const outLsum = ctx.createGain();
    const outRsum = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    this.widthIn.connect(splitter);
    splitter.connect(midL, 0); splitter.connect(midR, 1);
    splitter.connect(sideL, 0); splitter.connect(sideRneg, 1);
    midL.connect(midSum); midR.connect(midSum);
    sideL.connect(sideSum); sideRneg.connect(sideSum);
    sideSum.connect(this.sideScale);
    this.sideScale.connect(sideNeg);
    midSum.connect(outLsum); this.sideScale.connect(outLsum);
    midSum.connect(outRsum); sideNeg.connect(outRsum);
    outLsum.connect(merger, 0, 0);
    outRsum.connect(merger, 0, 1);
    merger.connect(this.widthWet);
    this.widthIn.connect(this.widthBypass);
    this.widthBypass.connect(this.widthOut);
    this.widthWet.connect(this.widthOut);

    // Bus / sends
    this.busIn = ctx.createGain();
    this.preOut = ctx.createGain();

    // Delay
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = state.delayTime;
    this.delayFbGain = ctx.createGain();
    this.delayFbGain.gain.value = state.delayFeedback;
    this.delayWetGain = ctx.createGain();
    this.delayWetGain.gain.value = state.delayEnabled ? state.delayWet : 0;

    // Reverb
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = createImpulseResponse(ctx, state.reverbSize, 3);
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = state.reverbEnabled ? state.reverbWet : 0;

    // Performance-bus effects
    this.gateGain = ctx.createGain();
    this.gateGain.gain.value = 1;
    this.pumpGain = ctx.createGain();
    this.pumpGain.gain.value = 1;

    // Master chain
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;

    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.value = state.masterGain;

    this.meterAnalyser = ctx.createAnalyser();
    this.meterAnalyser.fftSize = 1024;
    this.meterAnalyser.smoothingTimeConstant = 0;

    this.meterAnalyserL = ctx.createAnalyser();
    this.meterAnalyserL.fftSize = 1024;
    this.meterAnalyserL.smoothingTimeConstant = 0;
    this.meterAnalyserR = ctx.createAnalyser();
    this.meterAnalyserR.fftSize = 1024;
    this.meterAnalyserR.smoothingTimeConstant = 0;

    this.buildGraph();
  }

  private buildGraph() {
    // Drive chain
    this.input.connect(this.driveIn);
    this.driveIn.connect(this.drive);
    this.drive.connect(this.driveOut);

    // Filters in series
    this.driveOut.connect(this.hpf);
    this.hpf.connect(this.lpf);

    // Bitcrush after filters
    this.lpf.connect(this.crush);

    // Width
    this.crush.connect(this.widthIn);
    this.widthOut.connect(this.busIn);

    // Dry path
    this.busIn.connect(this.preOut);

    // Delay send
    this.busIn.connect(this.delayWetGain);
    this.delayWetGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFbGain);
    this.delayFbGain.connect(this.delayNode);
    this.delayNode.connect(this.preOut);

    // Reverb send
    this.busIn.connect(this.convolver);
    this.convolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.preOut);

    // Performance gate + pump → limiter → master → meter → output
    this.preOut.connect(this.gateGain);
    this.gateGain.connect(this.pumpGain);
    this.pumpGain.connect(this.limiter);
    this.limiter.connect(this.masterGainNode);
    this.masterGainNode.connect(this.meterAnalyser);
    this.meterAnalyser.connect(this.output);

    // Stereo meter taps — split post-master into L/R analysers
    const meterSplit = this.ctx.createChannelSplitter(2);
    this.masterGainNode.connect(meterSplit);
    meterSplit.connect(this.meterAnalyserL, 0);
    meterSplit.connect(this.meterAnalyserR, 1);
  }

  applyState(state: FXState) {
    this.state = { ...state };
    const t = this.ctx.currentTime;
    const TC = 0.015;

    // Drive
    if (Math.abs(state.driveAmount - this.currentDrive) > 0.001) {
      this.drive.curve = makeDriveCurve(state.driveEnabled ? state.driveAmount : 0) as any;
      this.currentDrive = state.driveAmount;
    } else if (!state.driveEnabled && this.currentDrive !== 0) {
      this.drive.curve = makeDriveCurve(0) as any;
      this.currentDrive = 0;
    }
    this.driveIn.gain.setTargetAtTime(state.driveEnabled ? 1 + state.driveAmount * 2 : 1, t, TC);
    this.driveOut.gain.setTargetAtTime(state.driveEnabled ? 1 / (1 + state.driveAmount * 0.5) : 1, t, TC);

    // Filters
    this.hpf.frequency.setTargetAtTime(state.hpfEnabled ? state.hpfFreq : 20, t, TC);
    this.lpf.frequency.setTargetAtTime(state.lpfEnabled ? state.lpfFreq : 18000, t, TC);

    // Bitcrush
    const targetBits = state.crushEnabled ? state.crushBits : 12;
    if (Math.abs(targetBits - this.currentBits) > 0.01) {
      this.crush.curve = makeCrushCurve(targetBits) as any;
      this.currentBits = targetBits;
    }

    // Width
    if (state.widthEnabled) {
      this.widthWet.gain.setTargetAtTime(1, t, TC);
      this.widthBypass.gain.setTargetAtTime(0, t, TC);
      this.sideScale.gain.setTargetAtTime(state.widthAmount, t, TC);
    } else {
      this.widthWet.gain.setTargetAtTime(0, t, TC);
      this.widthBypass.gain.setTargetAtTime(1, t, TC);
    }

    // Delay
    this.delayNode.delayTime.setTargetAtTime(state.delayTime, t, TC);
    this.delayFbGain.gain.setTargetAtTime(state.delayFeedback, t, TC);
    this.delayWetGain.gain.setTargetAtTime(state.delayEnabled ? state.delayWet : 0, t, TC);

    // Reverb
    this.reverbWetGain.gain.setTargetAtTime(state.reverbEnabled ? state.reverbWet : 0, t, TC);

    // Limiter on/off — use a generous threshold when disabled
    this.limiter.threshold.setTargetAtTime(state.limiterEnabled ? -1 : 0, t, TC);

    // Master
    this.masterGainNode.gain.setTargetAtTime(state.masterGain, t, TC);
  }

  syncDelay(bpm: number, div: ClockDivision) {
    const hz = (bpm / 60) * DIVISION_MULTIPLIERS[div];
    const secs = Math.min(1.9, 1 / hz);
    this.delayNode.delayTime.setTargetAtTime(secs, this.ctx.currentTime, 0.05);
  }

  /** Drive the trance-gate + pump automation ahead of the play cursor. */
  tickRhythmicFX(bpm: number) {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Gate: square-wave chop, aligned to the clock grid.
    const gate = this.gateGain.gain;
    gate.cancelScheduledValues(now);
    if (!this.state.gateEnabled) {
      gate.setTargetAtTime(1, now, 0.005);
    } else {
      const stepDur = 60 / (bpm * DIVISION_MULTIPLIERS[this.state.gateDiv]);
      const first = Math.ceil(now / stepDur) * stepDur;
      const num = Math.ceil(0.7 / stepDur) + 1;
      const low = Math.max(0, 1 - this.state.gateDepth);
      for (let i = 0; i < num; i++) {
        const t = first + i * stepDur;
        const open = i % 2 === 0;
        gate.setValueAtTime(open ? 1 : low, t);
      }
    }

    // Pump: kick-style duck envelope (snap down, release up)
    const pump = this.pumpGain.gain;
    pump.cancelScheduledValues(now);
    if (!this.state.pumpEnabled) {
      pump.setTargetAtTime(1, now, 0.005);
    } else {
      const beatDur = 60 / (bpm * DIVISION_MULTIPLIERS[this.state.pumpDiv]);
      const first = Math.ceil(now / beatDur) * beatDur;
      const num = Math.ceil(0.7 / beatDur) + 1;
      const duck = Math.max(0.05, 1 - this.state.pumpDepth);
      const attack = Math.min(0.01, beatDur * 0.05);
      const release = Math.min(beatDur * 0.85, 0.25);
      for (let i = 0; i < num; i++) {
        const t = first + i * beatDur;
        // Down-snap
        pump.setValueAtTime(1, t);
        pump.linearRampToValueAtTime(duck, t + attack);
        // Exponential release
        pump.exponentialRampToValueAtTime(0.9999, t + attack + release);
      }
    }
  }

  /** One-shot momentary performance triggers. */
  triggerPad(pad: PadId, bpm: number) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const beat = 60 / bpm;

    switch (pad) {
      case "impact": {
        const g = this.masterGainNode.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(this.state.masterGain, now);
        g.linearRampToValueAtTime(this.state.masterGain * 1.6, now + 0.005);
        g.exponentialRampToValueAtTime(Math.max(0.001, this.state.masterGain), now + 0.2);
        break;
      }
      case "killLow": {
        const f = this.hpf.frequency;
        f.cancelScheduledValues(now);
        f.setValueAtTime(800, now);
        f.exponentialRampToValueAtTime(Math.max(20, this.state.hpfEnabled ? this.state.hpfFreq : 20), now + beat * 2);
        break;
      }
      case "killHigh": {
        const f = this.lpf.frequency;
        f.cancelScheduledValues(now);
        f.setValueAtTime(800, now);
        f.exponentialRampToValueAtTime(this.state.lpfEnabled ? this.state.lpfFreq : 18000, now + beat * 2);
        break;
      }
      case "reverbThrow": {
        const g = this.reverbWetGain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(1, now);
        g.exponentialRampToValueAtTime(
          Math.max(0.001, this.state.reverbEnabled ? this.state.reverbWet : 0.001),
          now + beat * 2
        );
        break;
      }
      case "delayThrow": {
        const fb = this.delayFbGain.gain;
        const w = this.delayWetGain.gain;
        fb.cancelScheduledValues(now);
        w.cancelScheduledValues(now);
        fb.setValueAtTime(0.9, now);
        w.setValueAtTime(0.9, now);
        fb.linearRampToValueAtTime(this.state.delayFeedback, now + beat * 4);
        w.linearRampToValueAtTime(this.state.delayEnabled ? this.state.delayWet : 0, now + beat * 4);
        break;
      }
      case "drop": {
        const g = this.masterGainNode.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
        g.setValueAtTime(0, now + beat);
        g.linearRampToValueAtTime(this.state.masterGain, now + beat + 0.02);
        break;
      }
      case "sweepUp": {
        const f = this.lpf.frequency;
        f.cancelScheduledValues(now);
        f.setValueAtTime(300, now);
        f.exponentialRampToValueAtTime(18000, now + beat * 4);
        break;
      }
      case "stutter": {
        const g = this.gateGain.gain;
        g.cancelScheduledValues(now);
        const step = beat / 4; // 1/16 at current bpm
        for (let i = 0; i < 16; i++) {
          const t = now + i * step;
          g.setValueAtTime(i % 2 === 0 ? 1 : 0, t);
        }
        g.setValueAtTime(1, now + 16 * step);
        break;
      }
    }
  }

  destroy() {
    this.input.disconnect();
    this.driveIn.disconnect();
    this.drive.disconnect();
    this.driveOut.disconnect();
    this.hpf.disconnect();
    this.lpf.disconnect();
    this.crush.disconnect();
    this.widthIn.disconnect();
    this.widthOut.disconnect();
    this.widthBypass.disconnect();
    this.widthWet.disconnect();
    this.sideScale.disconnect();
    this.busIn.disconnect();
    this.preOut.disconnect();
    this.delayNode.disconnect();
    this.delayFbGain.disconnect();
    this.delayWetGain.disconnect();
    this.convolver.disconnect();
    this.reverbWetGain.disconnect();
    this.gateGain.disconnect();
    this.pumpGain.disconnect();
    this.limiter.disconnect();
    this.masterGainNode.disconnect();
    this.meterAnalyser.disconnect();
    this.meterAnalyserL.disconnect();
    this.meterAnalyserR.disconnect();
    this.output.disconnect();
  }
}
