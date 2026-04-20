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

// ─── LFO ────────────────────────────────────────────────────────────────────

export type LFOShape = "sine" | "triangle" | "saw" | "square" | "s&h";

export interface LFOState {
  id: "lfo1" | "lfo2";
  shape: LFOShape;
  rateHz: number;
  syncDiv: ClockDivision | null;
  depth: number;  // 0–1 (how much of the range it sweeps)
  bipolar: boolean;
  enabled: boolean;
}

export function defaultLFOState(id: "lfo1" | "lfo2"): LFOState {
  return {
    id,
    shape: "sine",
    rateHz: 0.25,
    syncDiv: null,
    depth: 0.5,
    bipolar: false,
    enabled: true,
  };
}

export class LFO {
  phase = 0;
  private lastSH = 0;
  private prevPhase = 0;

  constructor(public state: LFOState) {}

  /** Returns normalized value. Unipolar: 0–1. Bipolar: –depth..+depth. */
  tick(deltaSeconds: number, bpm: number): number {
    if (!this.state.enabled) return this.state.bipolar ? 0 : 0.5;

    const rateHz = this.state.syncDiv
      ? (bpm / 60) * DIVISION_MULTIPLIERS[this.state.syncDiv]
      : this.state.rateHz;

    this.prevPhase = this.phase;
    this.phase = (this.phase + deltaSeconds * rateHz) % 1;
    const wrapped = this.phase < this.prevPhase;

    let v: number;
    switch (this.state.shape) {
      case "sine":
        v = Math.sin(this.phase * 2 * Math.PI);
        break;
      case "triangle":
        v = this.phase < 0.5 ? this.phase * 4 - 1 : 3 - this.phase * 4;
        break;
      case "saw":
        v = this.phase * 2 - 1;
        break;
      case "square":
        v = this.phase < 0.5 ? 1 : -1;
        break;
      case "s&h":
        if (wrapped) this.lastSH = Math.random() * 2 - 1;
        v = this.lastSH;
        break;
      default:
        v = 0;
    }

    if (!this.state.bipolar) {
      v = (v + 1) * 0.5;  // 0..1
    }

    return v * this.state.depth;
  }
}

// ─── Step Sequencer ──────────────────────────────────────────────────────────

export interface SequencerState {
  steps: number[];    // 16 values, each 0–1
  gates: boolean[];   // 16 gate booleans
  currentStep: number;
  syncDiv: ClockDivision;
  running: boolean;
}

export function defaultSequencerState(): SequencerState {
  return {
    steps: Array(16).fill(0.5),
    gates: Array(16).fill(true),
    currentStep: 0,
    syncDiv: "1/8",
    running: true,
  };
}

export class StepSequencer {
  private accumulator = 0;
  private _currentStep = 0;

  constructor(public state: SequencerState) {
    this._currentStep = state.currentStep;
  }

  get currentStep() { return this._currentStep; }

  tick(deltaSeconds: number, bpm: number): { value: number; gate: boolean; step: number; advanced: boolean } {
    if (!this.state.running) {
      return { value: this.state.steps[this._currentStep], gate: false, step: this._currentStep, advanced: false };
    }

    const stepDuration = 60 / (bpm * DIVISION_MULTIPLIERS[this.state.syncDiv]);
    this.accumulator += deltaSeconds;

    let advanced = false;
    while (this.accumulator >= stepDuration) {
      this.accumulator -= stepDuration;
      this._currentStep = (this._currentStep + 1) % 16;
      this.state.currentStep = this._currentStep;
      advanced = true;
    }

    return {
      value: this.state.steps[this._currentStep],
      gate: this.state.gates[this._currentStep],
      step: this._currentStep,
      advanced,
    };
  }

  reset() {
    this.accumulator = 0;
    this._currentStep = 0;
    this.state.currentStep = 0;
  }
}

// ─── Envelope Follower ───────────────────────────────────────────────────────

export class EnvelopeFollower {
  private currentValue = 0;
  private analyser: AnalyserNode | null = null;
  private buffer: Uint8Array | null = null;

  attach(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.buffer = new Uint8Array(analyser.frequencyBinCount);
  }

  detach() {
    this.analyser = null;
    this.buffer = null;
  }

  tick(): number {
    if (!this.analyser || !this.buffer) return 0;
    this.analyser.getByteFrequencyData(this.buffer as any);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i];
    this.currentValue = sum / (this.buffer.length * 255);
    return this.currentValue;
  }

  get value() { return this.currentValue; }
}
