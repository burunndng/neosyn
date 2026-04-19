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

export interface FXState {
  hpfFreq: number;        // 20–2000 Hz
  hpfEnabled: boolean;
  lpfFreq: number;        // 200–20000 Hz
  lpfEnabled: boolean;
  delayTime: number;      // 0.01–1.9 s
  delayFeedback: number;  // 0–0.95
  delayWet: number;       // 0–1
  delayEnabled: boolean;
  delaySync: ClockDivision | null;
  reverbWet: number;      // 0–1
  reverbSize: number;     // impulse duration 0.5–5 s
  reverbEnabled: boolean;
}

export const DEFAULT_FX_STATE: FXState = {
  hpfFreq: 20,
  hpfEnabled: false,
  lpfFreq: 18000,
  lpfEnabled: false,
  delayTime: 0.375,
  delayFeedback: 0.4,
  delayWet: 0,
  delayEnabled: false,
  delaySync: "1/8",
  reverbWet: 0,
  reverbSize: 2.5,
  reverbEnabled: false,
};

/**
 * Signal flow:
 *   input → hpf → lpf → [dry] → output
 *                     → [delay send] → delay (with feedback) → output
 *                     → [reverb send] → convolver → reverbWet → output
 *
 * HPF/LPF are always in-line but default to fully transparent (20 Hz / 18 kHz).
 * Delay and reverb are parallel sends (adding to the dry signal).
 */
export class FXRack {
  readonly input: GainNode;
  readonly output: GainNode;

  // Filters
  readonly hpf: BiquadFilterNode;
  readonly lpf: BiquadFilterNode;

  // Delay
  private readonly delayNode: DelayNode;
  private readonly delayFbGain: GainNode;
  readonly delayWetGain: GainNode;

  // Reverb
  private readonly convolver: ConvolverNode;
  readonly reverbWetGain: GainNode;

  private readonly ctx: AudioContext;

  constructor(ctx: AudioContext, state: FXState) {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // HPF — default 20 Hz (transparent)
    this.hpf = ctx.createBiquadFilter();
    this.hpf.type = "highpass";
    this.hpf.frequency.value = state.hpfFreq;
    this.hpf.Q.value = 0.707;

    // LPF — default 18 kHz (transparent)
    this.lpf = ctx.createBiquadFilter();
    this.lpf.type = "lowpass";
    this.lpf.frequency.value = state.lpfFreq;
    this.lpf.Q.value = 0.707;

    // Ping-pong delay via two series delays, slightly different times
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = state.delayTime;
    this.delayFbGain = ctx.createGain();
    this.delayFbGain.gain.value = state.delayFeedback;
    this.delayWetGain = ctx.createGain();
    this.delayWetGain.gain.value = state.delayWet;

    // Reverb
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = createImpulseResponse(ctx, state.reverbSize, 3);
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = state.reverbWet;

    this.buildGraph();
  }

  private buildGraph() {
    // Filters in series (always in path)
    this.input.connect(this.hpf);
    this.hpf.connect(this.lpf);

    // Dry path (always)
    this.lpf.connect(this.output);

    // Delay send
    this.lpf.connect(this.delayWetGain);
    this.delayWetGain.connect(this.delayNode);
    this.delayNode.connect(this.delayFbGain);
    this.delayFbGain.connect(this.delayNode);   // feedback loop
    this.delayNode.connect(this.output);         // wet output

    // Reverb send
    this.lpf.connect(this.convolver);
    this.convolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.output);
  }

  /** Apply all FX state params smoothly. Pass `bpm` so delaySync resolves to seconds. */
  applyState(state: FXState, bpm = 120) {
    const t = this.ctx.currentTime;
    const TC = 0.015;

    this.hpf.frequency.setTargetAtTime(
      state.hpfEnabled ? state.hpfFreq : 20,
      t, TC
    );
    this.lpf.frequency.setTargetAtTime(
      state.lpfEnabled ? state.lpfFreq : 18000,
      t, TC
    );

    const delaySecs = state.delaySync
      ? Math.min(1.9, 1 / ((bpm / 60) * DIVISION_MULTIPLIERS[state.delaySync]))
      : state.delayTime;
    this.delayNode.delayTime.setTargetAtTime(delaySecs, t, TC);

    this.delayFbGain.gain.setTargetAtTime(state.delayFeedback, t, TC);
    this.delayWetGain.gain.setTargetAtTime(state.delayEnabled ? state.delayWet : 0, t, TC);
    this.reverbWetGain.gain.setTargetAtTime(state.reverbEnabled ? state.reverbWet : 0, t, TC);
  }

  destroy() {
    this.input.disconnect();
    this.hpf.disconnect();
    this.lpf.disconnect();
    this.delayNode.disconnect();
    this.delayFbGain.disconnect();
    this.delayWetGain.disconnect();
    this.convolver.disconnect();
    this.reverbWetGain.disconnect();
    this.output.disconnect();
  }
}
