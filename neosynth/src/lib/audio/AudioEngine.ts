import type { FXRack } from "./FXRack";
import { masterClock } from "./MasterClock";
import type { ClockDivision } from "./MasterClock";

export type BilateralPattern =
  | "pure-alternation"
  | "mirrored-overlap"
  | "asymmetric"
  | "clustered"
  | "randomized"
  | "ping-pong-sweep"
  | "heartbeat"
  | "bilateral-roll";

export type CarrierType = "sine" | "pink-noise" | "brown-noise" | "band-limited" | "sample";
export type PanMode = "hard" | "smooth";

export interface SynthParams {
  pattern: BilateralPattern;
  rate: number;
  carrierType: CarrierType;
  carrierFrequency: number;
  sampleUrl: string | null;
  layerAGain: number;
  layerAMuted: boolean;
  layerAMode: "loop" | "oneshot";
  layerARate: number | null;
  layerADivision: ClockDivision | null;
  layerBEnabled: boolean;
  layerBCarrierType: CarrierType;
  layerBCarrierFrequency: number;
  layerBGain: number;
  layerBMuted: boolean;
  layerBSampleUrl: string | null;
  layerBMode: "loop" | "oneshot";
  layerBRate: number | null;
  layerBDivision: ClockDivision | null;
  layerBPattern: BilateralPattern | null;
  soloLayer: "A" | "B" | null;
  attack: number;
  decay: number;
  dutyCycle: number;
  leftGain: number;
  rightGain: number;
  panMode: PanMode;
  asymmetricLeftRate: number;
  asymmetricRightRate: number;
  clusterBurstCount: number;
  clusterBurstRate: number;
  clusterPauseDuration: number;
  randomMinInterval: number;
  randomMaxInterval: number;
  swing: number;
  sidechainEnabled: boolean;
  sidechainDepth: number;
  sidechainDuration: number;
}

export const DEFAULT_PARAMS: SynthParams = {
  pattern: "pure-alternation",
  rate: 4,
  carrierType: "sine",
  carrierFrequency: 200,
  sampleUrl: null,
  layerAGain: 1,
  layerAMuted: false,
  layerAMode: "loop",
  layerARate: null,
  layerADivision: null,
  layerBEnabled: false,
  layerBCarrierType: "pink-noise",
  layerBCarrierFrequency: 200,
  layerBGain: 0.5,
  layerBMuted: false,
  layerBSampleUrl: null,
  layerBMode: "loop",
  layerBRate: null,
  layerBDivision: null,
  layerBPattern: null,
  soloLayer: null,
  attack: 0.05,
  decay: 0.1,
  dutyCycle: 0.5,
  leftGain: 0.8,
  rightGain: 0.8,
  panMode: "hard",
  asymmetricLeftRate: 3,
  asymmetricRightRate: 5,
  clusterBurstCount: 3,
  clusterBurstRate: 10,
  clusterPauseDuration: 0.5,
  randomMinInterval: 0.2,
  randomMaxInterval: 0.6,
  swing: 0,
  sidechainEnabled: false,
  sidechainDepth: 0.7,
  sidechainDuration: 0.12,
};

function createNoiseBuffer(
  ctx: BaseAudioContext,
  type: "pink" | "brown" | "white",
  duration = 2
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = sampleRate * duration;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < frameCount; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969   * b2 + w * 0.153852;
      b3 = 0.8665  * b3 + w * 0.3104856;
      b4 = 0.55    * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else if (type === "brown") {
    let last = 0;
    for (let i = 0; i < frameCount; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return buffer;
}

interface CarrierPair {
  source: OscillatorNode | AudioBufferSourceNode;
  output: AudioNode;
}

function createSynthCarrier(
  ctx: BaseAudioContext,
  type: CarrierType,
  frequency: number,
  sampleBuffer: AudioBuffer | null
): CarrierPair {
  if (type === "sine") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.start(0);
    return { source: osc, output: osc };
  }

  if (type === "sample" && sampleBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = sampleBuffer;
    src.loop = true;
    src.start(0);
    return { source: src, output: src };
  }

  const noiseType: "pink" | "brown" | "white" =
    type === "pink-noise" ? "pink"
    : type === "brown-noise" ? "brown"
    : "white";

  const buffer = createNoiseBuffer(ctx, noiseType);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start(0);

  if (type === "band-limited") {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 2;
    src.connect(filter);
    return { source: src, output: filter };
  }

  return { source: src, output: src };
}

interface BilateralGraph {
  carrierA: CarrierPair;
  carrierB: CarrierPair | null;
  layerAGain: GainNode;
  layerBGain: GainNode | null;
  // Per-layer independent envelope + panner + splitter
  envGainA: GainNode;
  envGainB: GainNode;
  pannerA: StereoPannerNode;
  pannerB: StereoPannerNode;
  splitterA: ChannelSplitterNode;
  splitterB: ChannelSplitterNode;
  // Sidechain: sits between layerBGain and envGainB — mod-matrix never writes here
  sidechainGain: GainNode;
  // Aliases kept for mod-matrix / legacy callers
  envGain: GainNode;    // = envGainA
  panner: StereoPannerNode;  // = pannerA
  splitter: ChannelSplitterNode;  // = splitterA
  leftLevel: GainNode;
  rightLevel: GainNode;
  merger: ChannelMergerNode;
  masterGain: GainNode;
}

function buildGraph(
  ctx: BaseAudioContext,
  params: SynthParams,
  sampleBufferA: AudioBuffer | null,
  sampleBufferB: AudioBuffer | null
): BilateralGraph {
  // ── Layer A ──────────────────────────────────────────────────────────────
  // In oneshot mode we don't build a looping carrier — pulses are triggered
  // individually. The looping carrier is only built in "loop" mode.
  const carrierA = params.layerAMode === "oneshot"
    ? createSynthCarrier(ctx, "sine", 1, null)  // dummy silent carrier
    : createSynthCarrier(ctx, params.carrierType, params.carrierFrequency, sampleBufferA);

  const layerAGain = ctx.createGain();
  const layerAEffectiveGain = params.soloLayer === "B" || params.layerAMuted ? 0 : params.layerAGain;
  layerAGain.gain.value = layerAEffectiveGain;

  // In oneshot mode envGainA stays at 1; individual shots have their own envelope
  const envGainA = ctx.createGain();
  envGainA.gain.value = params.layerAMode === "loop" ? 0 : 1;

  if (params.layerAMode === "loop") {
    carrierA.output.connect(layerAGain);
    layerAGain.connect(envGainA);
  }
  // (In oneshot mode, shots connect directly into layerAGain → envGainA at schedule time)

  // ── Layer B ──────────────────────────────────────────────────────────────
  let carrierB: CarrierPair | null = null;
  let layerBGainNode: GainNode | null = null;
  const envGainB = ctx.createGain();
  envGainB.gain.value = 0;

  // Sidechain node — always created; insertion between layerBGain and envGainB.
  // Mod-matrix never writes here, so sidechain dips are safe from automation conflicts.
  const sidechainGain = ctx.createGain();
  sidechainGain.gain.value = 1;

  if (params.layerBEnabled) {
    carrierB = params.layerBMode === "oneshot"
      ? createSynthCarrier(ctx, "sine", 1, null)  // dummy silent carrier
      : createSynthCarrier(ctx, params.layerBCarrierType, params.layerBCarrierFrequency, sampleBufferB);

    layerBGainNode = ctx.createGain();
    const layerBEffectiveGain = params.soloLayer === "A" || params.layerBMuted ? 0 : params.layerBGain;
    layerBGainNode.gain.value = layerBEffectiveGain;

    if (params.layerBMode === "loop") {
      carrierB.output.connect(layerBGainNode);
      layerBGainNode.connect(sidechainGain);
      sidechainGain.connect(envGainB);
      envGainB.gain.value = 0;
    } else {
      // Oneshot sources connect directly into layerBGain at schedule time,
      // and layerBGain still feeds sidechain → envGainB so shots are ducked too.
      layerBGainNode.connect(sidechainGain);
      sidechainGain.connect(envGainB);
      envGainB.gain.value = 1;
    }
  }

  // ── Per-layer panner + splitter ───────────────────────────────────────────
  // Both panners' output channels are summed into shared leftLevel / rightLevel.
  const leftLevel = ctx.createGain();
  leftLevel.gain.value = params.leftGain;
  const rightLevel = ctx.createGain();
  rightLevel.gain.value = params.rightGain;
  const merger = ctx.createChannelMerger(2);
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;

  const pannerA = ctx.createStereoPanner();
  pannerA.pan.value = -1;
  const splitterA = ctx.createChannelSplitter(2);
  envGainA.connect(pannerA);
  pannerA.connect(splitterA);
  splitterA.connect(leftLevel, 0);
  splitterA.connect(rightLevel, 1);

  const pannerB = ctx.createStereoPanner();
  pannerB.pan.value = -1;
  const splitterB = ctx.createChannelSplitter(2);
  if (params.layerBEnabled) {
    envGainB.connect(pannerB);
    pannerB.connect(splitterB);
    splitterB.connect(leftLevel, 0);
    splitterB.connect(rightLevel, 1);
  }

  leftLevel.connect(merger, 0, 0);
  rightLevel.connect(merger, 0, 1);
  merger.connect(masterGain);

  return {
    carrierA,
    carrierB,
    layerAGain,
    layerBGain: layerBGainNode,
    envGainA,
    envGainB,
    pannerA,
    pannerB,
    splitterA,
    splitterB,
    sidechainGain,
    // backward-compat aliases
    envGain: envGainA,
    panner: pannerA,
    splitter: splitterA,
    leftLevel,
    rightLevel,
    merger,
    masterGain,
  };
}

function teardownGraph(graph: BilateralGraph) {
  for (const carrier of [graph.carrierA, graph.carrierB]) {
    if (!carrier) continue;
    try { carrier.source.stop(); } catch {}
    carrier.source.disconnect();
    if (carrier.output !== carrier.source) carrier.output.disconnect();
  }
  graph.layerAGain.disconnect();
  graph.layerBGain?.disconnect();
  graph.envGainA.disconnect();
  graph.envGainB.disconnect();
  graph.pannerA.disconnect();
  graph.pannerB.disconnect();
  graph.splitterA.disconnect();
  graph.splitterB.disconnect();
  graph.sidechainGain.disconnect();
  graph.leftLevel.disconnect();
  graph.rightLevel.disconnect();
  graph.merger.disconnect();
  graph.masterGain.disconnect();
}

interface ChunkState {
  nextLeft: number;
  nextRight: number;
  side: "left" | "right";
  rollPhase: number;
  pulseIdx: number;
}

interface ChunkResult {
  endTime: number;
  nextLeftTime: number;
  nextRightTime: number;
  nextSide: "left" | "right";
  rollPhase: number;
  pulseIdx: number;
}

/** Compute effective Hz for a layer, respecting its rate/division overrides. */
function effectiveLayerRate(
  layerRate: number | null,
  layerDivision: ClockDivision | null,
  fallbackRate: number
): number {
  if (layerDivision !== null) return masterClock.divisionHz(layerDivision);
  if (layerRate !== null) return layerRate;
  return fallbackRate;
}

/** Schedule a one-shot sample pulse. Creates a new BufferSourceNode per pulse. */
function scheduleOneShot(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  channel: "left" | "right" | "both",
  panner: StereoPannerNode,
  layerGain: GainNode,
  panMode: PanMode,
  attack: number,
  decay: number,
  pulseDur: number,
  t: number
): void {
  if (pulseDur < 0.002) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const oneShotEnv = ctx.createGain();
  oneShotEnv.gain.setValueAtTime(0, t);
  oneShotEnv.gain.linearRampToValueAtTime(1, t + attack);
  const sustain = Math.max(0, pulseDur - attack - decay);
  oneShotEnv.gain.setValueAtTime(1, t + attack + sustain);
  oneShotEnv.gain.linearRampToValueAtTime(0, t + attack + sustain + decay);
  src.connect(oneShotEnv);
  oneShotEnv.connect(layerGain);
  const targetPan = channel === "both" ? 0 : channel === "left" ? -1 : 1;
  if (panMode === "hard") {
    panner.pan.setValueAtTime(targetPan, t);
  } else {
    panner.pan.linearRampToValueAtTime(targetPan, t + Math.min(pulseDur * 0.5, 0.05));
  }
  src.start(t);
  src.stop(t + pulseDur + decay + 0.05);
  src.onended = () => { try { oneShotEnv.disconnect(); src.disconnect(); } catch {} };
}

function scheduleChunk(
  ctx: BaseAudioContext,
  envGain: GainNode,
  panner: StereoPannerNode,
  params: SynthParams,
  chunkStart: number,
  chunkDuration: number,
  state: ChunkState,
  layerMode: "loop" | "oneshot",
  sampleBuffer: AudioBuffer | null,
  layerGain: GainNode,
  rate: number,
  pattern: BilateralPattern,
  sidechainGain: GainNode | null = null
): ChunkResult {
  const { attack, decay, dutyCycle, panMode } = params;
  const chunkEnd = chunkStart + chunkDuration;
  let { side } = state;
  const interval = 1 / rate;
  const swing = Math.max(0, Math.min(0.5, params.swing ?? 0));
  // Pulse counter continues across chunks so swing is consistent.
  let pulseIdx = state.pulseIdx ?? 0;
  function applySwing(t: number): number {
    if (swing <= 0) return t;
    return pulseIdx % 2 === 1 ? t + interval * swing * 0.5 : t;
  }

  function scheduleSidechain(t: number) {
    if (!sidechainGain || !params.sidechainEnabled) return;
    const depth = Math.max(0, Math.min(1, params.sidechainDepth));
    const dur = Math.max(0.02, Math.min(0.5, params.sidechainDuration));
    const floor = 1 - depth;
    // Abrupt dip at t (fast attack), linear recover over dur.
    sidechainGain.gain.cancelScheduledValues(t);
    sidechainGain.gain.setValueAtTime(1, t);
    sidechainGain.gain.linearRampToValueAtTime(floor, t + 0.005);
    sidechainGain.gain.linearRampToValueAtTime(1, t + dur);
  }

  function schedulePulseAt(t: number, channel: "left" | "right" | "both", pulseDur: number) {
    const tt = applySwing(t);
    pulseIdx++;
    scheduleSidechain(tt);
    if (layerMode === "oneshot" && sampleBuffer) {
      scheduleOneShot(ctx, sampleBuffer, channel, panner, layerGain, panMode, attack, decay, pulseDur, tt);
      return;
    }
    envGain.gain.cancelScheduledValues(tt);
    envGain.gain.setValueAtTime(0, tt);
    envGain.gain.linearRampToValueAtTime(1, tt + attack);
    const sustain = Math.max(0, pulseDur - attack - decay);
    envGain.gain.setValueAtTime(1, tt + attack + sustain);
    envGain.gain.linearRampToValueAtTime(0, tt + attack + sustain + decay);

    const targetPan = channel === "both" ? 0 : channel === "left" ? -1 : 1;
    if (panMode === "hard") {
      panner.pan.setValueAtTime(targetPan, tt);
    } else {
      panner.pan.linearRampToValueAtTime(targetPan, tt + Math.min(pulseDur * 0.5, interval * 0.4));
    }
  }

  if (pattern === "pure-alternation") {
    let t = Math.min(state.nextLeft, state.nextRight);
    const pulseDur = interval * dutyCycle;
    while (t < chunkEnd) {
      schedulePulseAt(t, side, pulseDur);
      side = side === "left" ? "right" : "left";
      t += interval;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0, pulseIdx };
  }

  if (pattern === "mirrored-overlap") {
    let t = Math.min(state.nextLeft, state.nextRight);
    const pulseDur = interval * dutyCycle;
    while (t < chunkEnd) {
      schedulePulseAt(t, "both", pulseDur);
      t += interval;
      if (t < chunkEnd) {
        schedulePulseAt(t, side, pulseDur);
        side = side === "left" ? "right" : "left";
        t += interval;
      }
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0, pulseIdx };
  }

  if (pattern === "asymmetric") {
    const leftInterval = 1 / params.asymmetricLeftRate;
    const rightInterval = 1 / params.asymmetricRightRate;
    let nextLeft = state.nextLeft;
    let nextRight = state.nextRight;
    const pulseDur = interval * dutyCycle;
    while (nextLeft < chunkEnd || nextRight < chunkEnd) {
      if (nextLeft <= nextRight && nextLeft < chunkEnd) {
        schedulePulseAt(nextLeft, "left", pulseDur);
        nextLeft += leftInterval;
      } else if (nextRight < chunkEnd) {
        schedulePulseAt(nextRight, "right", pulseDur);
        nextRight += rightInterval;
      } else {
        break;
      }
    }
    return { endTime: Math.max(nextLeft, nextRight), nextLeftTime: nextLeft, nextRightTime: nextRight, nextSide: side, rollPhase: 0, pulseIdx };
  }

  if (pattern === "clustered") {
    const burstInterval = 1 / params.clusterBurstRate;
    let t = Math.min(state.nextLeft, state.nextRight);
    while (t < chunkEnd) {
      for (let b = 0; b < params.clusterBurstCount; b++) {
        const bt = t + b * burstInterval;
        if (bt >= chunkEnd) break;
        schedulePulseAt(bt, side, burstInterval * dutyCycle);
        side = side === "left" ? "right" : "left";
      }
      t += params.clusterBurstCount * burstInterval + params.clusterPauseDuration;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0, pulseIdx };
  }

  if (pattern === "randomized") {
    let t = Math.min(state.nextLeft, state.nextRight);
    while (t < chunkEnd) {
      const ri = params.randomMinInterval + Math.random() * (params.randomMaxInterval - params.randomMinInterval);
      schedulePulseAt(t, side, ri * dutyCycle);
      side = side === "left" ? "right" : "left";
      t += ri;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0, pulseIdx };
  }

  // Ping-Pong Sweep: continuous sine-wave panning, discrete envelope pulses
  if (pattern === "ping-pong-sweep") {
    let t = Math.min(state.nextLeft, state.nextRight);
    const pulseDur = interval * dutyCycle;
    const sweepPeriod = 1 / rate;
    const steps = Math.ceil(chunkDuration / 0.02);
    for (let i = 0; i <= steps; i++) {
      const st = chunkStart + (i / steps) * chunkDuration;
      const phase = (2 * Math.PI * st) / sweepPeriod;
      panner.pan.linearRampToValueAtTime(Math.sin(phase), st);
    }
    while (t < chunkEnd) {
      const tt = applySwing(t);
      pulseIdx++;
      scheduleSidechain(tt);
      if (layerMode === "oneshot" && sampleBuffer) {
        scheduleOneShot(ctx, sampleBuffer, "both", panner, layerGain, panMode, attack, decay, pulseDur, tt);
      } else {
        envGain.gain.cancelScheduledValues(tt);
        envGain.gain.setValueAtTime(0, tt);
        envGain.gain.linearRampToValueAtTime(1, tt + attack);
        const sustain = Math.max(0, pulseDur - attack - decay);
        envGain.gain.setValueAtTime(1, tt + attack + sustain);
        envGain.gain.linearRampToValueAtTime(0, tt + attack + sustain + decay);
      }
      t += interval;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0, pulseIdx };
  }

  // Heartbeat: lub-dub double pulse per cycle, long gap between pairs
  if (pattern === "heartbeat") {
    let t = Math.min(state.nextLeft, state.nextRight);
    const lubDur = 0.06;
    const dubDur = 0.06;
    const dubDelay = 0.14;
    while (t < chunkEnd) {
      // "lub"
      if (t < chunkEnd) {
        schedulePulseAt(t, side, lubDur);
      }
      // "dub"
      const dubT = t + dubDelay;
      if (dubT < chunkEnd) {
        schedulePulseAt(dubT, side === "left" ? "right" : "left", dubDur);
      }
      side = side === "left" ? "right" : "left";
      t += interval;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0, pulseIdx };
  }

  // Bilateral Roll: accelerating burst that speeds up through the cycle then resets
  if (pattern === "bilateral-roll") {
    let t = Math.min(state.nextLeft, state.nextRight);
    let rollPhase = state.rollPhase;
    const cycleSteps = 6;
    while (t < chunkEnd) {
      const step = rollPhase % cycleSteps;
      const speedFactor = 1 + step * 0.5;
      const pulseDur = (interval / speedFactor) * dutyCycle;
      schedulePulseAt(t, side, pulseDur);
      side = side === "left" ? "right" : "left";
      t += interval / speedFactor;
      rollPhase++;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase, pulseIdx };
  }

  return { endTime: chunkEnd, nextLeftTime: chunkEnd, nextRightTime: chunkEnd, nextSide: side, rollPhase: 0, pulseIdx };
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: BilateralGraph | null = null;
  private userAudioSource: AudioBufferSourceNode | null = null;
  private userAudioBuffer: AudioBuffer | null = null;
  private sampleBufferA: AudioBuffer | null = null;
  private sampleBufferB: AudioBuffer | null = null;
  private scheduleInterval: ReturnType<typeof setInterval> | null = null;
  private scheduleEnd = 0;
  private scheduleStateA: ChunkState = { nextLeft: 0, nextRight: 0, side: "left", rollPhase: 0, pulseIdx: 0 };
  private scheduleStateB: ChunkState = { nextLeft: 0, nextRight: 0, side: "left", rollPhase: 0, pulseIdx: 0 };
  private isPlaying = false;
  private playingListeners = new Set<(v: boolean) => void>();
  private params: SynthParams = { ...DEFAULT_PARAMS };

  // Live mode extensions
  private fxRack: FXRack | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private modOverrides: Partial<SynthParams> = {};

  updateParams(newParams: SynthParams) {
    const prev = this.params;
    this.params = { ...newParams };

    if (!this.isPlaying || !this.ctx || !this.graph) return;

    const needsRebuild =
      newParams.carrierType !== prev.carrierType ||
      newParams.layerBEnabled !== prev.layerBEnabled ||
      newParams.layerBCarrierType !== prev.layerBCarrierType ||
      newParams.panMode !== prev.panMode ||
      newParams.sampleUrl !== prev.sampleUrl ||
      newParams.layerBSampleUrl !== prev.layerBSampleUrl ||
      newParams.layerAMode !== prev.layerAMode ||
      newParams.layerBMode !== prev.layerBMode;

    if (needsRebuild) {
      this.stop();
      void this.start();
      return;
    }

    this.graph.leftLevel.gain.setTargetAtTime(newParams.leftGain, this.ctx.currentTime, 0.01);
    this.graph.rightLevel.gain.setTargetAtTime(newParams.rightGain, this.ctx.currentTime, 0.01);

    const layerAEffectiveGain = newParams.soloLayer === "B" || newParams.layerAMuted ? 0 : newParams.layerAGain;
    this.graph.layerAGain.gain.setTargetAtTime(layerAEffectiveGain, this.ctx.currentTime, 0.01);

    if (this.graph.layerBGain) {
      const layerBEffectiveGain = newParams.soloLayer === "A" || newParams.layerBMuted ? 0 : newParams.layerBGain;
      this.graph.layerBGain.gain.setTargetAtTime(layerBEffectiveGain, this.ctx.currentTime, 0.01);
    }

    if (newParams.carrierFrequency !== prev.carrierFrequency) {
      const { source } = this.graph.carrierA;
      if (source instanceof OscillatorNode) {
        source.frequency.setTargetAtTime(newParams.carrierFrequency, this.ctx.currentTime, 0.01);
      }
      if (this.graph.carrierA.output instanceof BiquadFilterNode) {
        this.graph.carrierA.output.frequency.setTargetAtTime(newParams.carrierFrequency, this.ctx.currentTime, 0.01);
      }
    }

    if (newParams.layerBCarrierFrequency !== prev.layerBCarrierFrequency && this.graph.carrierB) {
      const { source } = this.graph.carrierB;
      if (source instanceof OscillatorNode) {
        source.frequency.setTargetAtTime(newParams.layerBCarrierFrequency, this.ctx.currentTime, 0.01);
      }
      if (this.graph.carrierB.output instanceof BiquadFilterNode) {
        this.graph.carrierB.output.frequency.setTargetAtTime(newParams.layerBCarrierFrequency, this.ctx.currentTime, 0.01);
      }
    }
  }

  async setUserAudio(file: File) {
    if (!this.ctx) await this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    this.userAudioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
  }

  async loadSampleUrl(url: string, layer: "A" | "B"): Promise<void> {
    await this.ensureContext();
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
    if (layer === "A") {
      this.sampleBufferA = decoded;
    } else {
      this.sampleBufferB = decoded;
    }
  }

  private previewSource: AudioBufferSourceNode | null = null;
  private previewUrl: string | null = null;

  /**
   * Preview a sample. Calling again stops the previous preview first.
   * Calling with the same URL while it's still playing toggles it off.
   * Routes through masterGain when live so FX + recorder capture it.
   */
  async previewSample(url: string): Promise<void> {
    await this.ensureContext();

    // If the same sample is already playing, treat this as a stop.
    const alreadyPlaying = this.previewSource !== null && this.previewUrl === url;
    this.stopPreview();
    if (alreadyPlaying) return;

    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
    const src = this.ctx!.createBufferSource();
    src.buffer = decoded;

    const target: AudioNode = this.graph?.masterGain ?? this.ctx!.destination;
    src.connect(target);
    src.onended = () => {
      if (this.previewSource === src) {
        this.previewSource = null;
        this.previewUrl = null;
      }
    };
    src.start(0);
    const dur = Math.min(decoded.duration, 2);
    src.stop(this.ctx!.currentTime + dur);
    this.previewSource = src;
    this.previewUrl = url;
  }

  stopPreview() {
    if (!this.previewSource) return;
    try { this.previewSource.stop(); } catch {}
    try { this.previewSource.disconnect(); } catch {}
    this.previewSource = null;
    this.previewUrl = null;
  }

  getPreviewUrl(): string | null { return this.previewUrl; }

  private async ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 44100 });
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  async start() {
    if (this.isPlaying) return;
    await this.ensureContext();
    this.isPlaying = true;
    this.emitPlaying();

    // Load sample buffers from URLs if needed
    if (this.params.carrierType === "sample" && this.params.sampleUrl && !this.sampleBufferA) {
      await this.loadSampleUrl(this.params.sampleUrl, "A");
    }
    if (this.params.layerBEnabled && this.params.layerBCarrierType === "sample" && this.params.layerBSampleUrl && !this.sampleBufferB) {
      await this.loadSampleUrl(this.params.layerBSampleUrl, "B");
    }

    const graph = buildGraph(this.ctx!, this.params, this.sampleBufferA, this.sampleBufferB);
    this.graph = graph;

    if (this.userAudioBuffer) {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.userAudioBuffer;
      src.loop = true;
      src.connect(graph.masterGain);
      src.start();
      this.userAudioSource = src;
    }

    // Route: masterGain → [fxRack →] [analyser →] destination
    const finalDest: AudioNode = this.analyserNode
      ? this.analyserNode
      : this.ctx!.destination;

    if (this.fxRack) {
      graph.masterGain.connect(this.fxRack.input);
      this.fxRack.output.connect(finalDest);
    } else {
      graph.masterGain.connect(finalDest);
    }
    if (this.analyserNode) {
      this.analyserNode.connect(this.ctx!.destination);
    }
    if (this.streamDest) {
      const streamSrc = this.fxRack ? this.fxRack.output : graph.masterGain;
      streamSrc.connect(this.streamDest);
    }

    const startOffset = this.ctx!.currentTime + 0.05;
    this.scheduleEnd = startOffset;
    this.scheduleStateA = { nextLeft: startOffset, nextRight: startOffset, side: "left", rollPhase: 0, pulseIdx: 0 };
    this.scheduleStateB = { nextLeft: startOffset, nextRight: startOffset, side: "left", rollPhase: 0, pulseIdx: 0 };
    this.runScheduler();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.emitPlaying();
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
    if (this.graph) {
      teardownGraph(this.graph);
      this.graph = null;
    }
    if (this.userAudioSource) {
      try { this.userAudioSource.stop(); } catch {}
      this.userAudioSource.disconnect();
      this.userAudioSource = null;
    }
  }

  private runScheduler() {
    const LOOK_AHEAD = 0.3;
    const CHUNK_DURATION = 0.5;
    const INTERVAL_MS = 50;

    const schedule = () => {
      if (!this.isPlaying || !this.ctx || !this.graph) return;
      const now = this.ctx.currentTime;
      while (this.scheduleEnd < now + LOOK_AHEAD) {
        const ep = this.effectiveParams();
        const rateA = effectiveLayerRate(ep.layerARate, ep.layerADivision, ep.rate);
        const patternA = ep.pattern;

        const resultA = scheduleChunk(
          this.ctx,
          this.graph.envGainA,
          this.graph.pannerA,
          ep,
          this.scheduleEnd,
          CHUNK_DURATION,
          this.scheduleStateA,
          ep.layerAMode,
          ep.layerAMode === "oneshot" ? this.sampleBufferA : null,
          this.graph.layerAGain,
          rateA,
          patternA,
          this.graph.sidechainGain  // Layer A drives the duck
        );
        this.scheduleStateA = {
          nextLeft: resultA.nextLeftTime,
          nextRight: resultA.nextRightTime,
          side: resultA.nextSide,
          rollPhase: resultA.rollPhase,
          pulseIdx: resultA.pulseIdx,
        };

        if (ep.layerBEnabled) {
          const rateB = effectiveLayerRate(ep.layerBRate, ep.layerBDivision, ep.rate);
          const patternB = ep.layerBPattern ?? ep.pattern;
          const resultB = scheduleChunk(
            this.ctx,
            this.graph.envGainB,
            this.graph.pannerB,
            ep,
            this.scheduleEnd,
            CHUNK_DURATION,
            this.scheduleStateB,
            ep.layerBMode,
            ep.layerBMode === "oneshot" ? this.sampleBufferB : null,
            this.graph.layerBGain ?? this.graph.layerAGain,
            rateB,
            patternB,
            null  // Layer B is the receiver, not driver
          );
          this.scheduleStateB = {
            nextLeft: resultB.nextLeftTime,
            nextRight: resultB.nextRightTime,
            side: resultB.nextSide,
            rollPhase: resultB.rollPhase,
            pulseIdx: resultB.pulseIdx,
          };
        }

        this.scheduleEnd = resultA.endTime;
      }
    };

    schedule();
    this.scheduleInterval = setInterval(schedule, INTERVAL_MS);
  }

  async renderOffline(
    params: SynthParams,
    durationSeconds: number,
    _bitDepth: 16 | 24
  ): Promise<AudioBuffer> {
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * durationSeconds, sampleRate);

    const bufA = params.carrierType === "sample" ? this.sampleBufferA : null;
    const bufB = (params.layerBEnabled && params.layerBCarrierType === "sample") ? this.sampleBufferB : null;

    const graph = buildGraph(offlineCtx, params, bufA, bufB);
    graph.masterGain.connect(offlineCtx.destination);

    if (this.userAudioBuffer) {
      const src = offlineCtx.createBufferSource();
      src.buffer = this.userAudioBuffer;
      src.loop = true;
      src.connect(graph.masterGain);
      src.start(0);
    }

    const initStateA: ChunkState = { nextLeft: 0, nextRight: 0, side: "left", rollPhase: 0, pulseIdx: 0 };
    const rateA = effectiveLayerRate(params.layerARate, params.layerADivision, params.rate);
    scheduleChunk(offlineCtx, graph.envGainA, graph.pannerA, params, 0, durationSeconds, initStateA,
      params.layerAMode, params.layerAMode === "oneshot" ? bufA : null, graph.layerAGain,
      rateA, params.pattern, graph.sidechainGain);

    if (params.layerBEnabled) {
      const initStateB: ChunkState = { nextLeft: 0, nextRight: 0, side: "left", rollPhase: 0, pulseIdx: 0 };
      const rateB = effectiveLayerRate(params.layerBRate, params.layerBDivision, params.rate);
      const patternB = params.layerBPattern ?? params.pattern;
      scheduleChunk(offlineCtx, graph.envGainB, graph.pannerB, params, 0, durationSeconds, initStateB,
        params.layerBMode, params.layerBMode === "oneshot" ? bufB : null,
        graph.layerBGain ?? graph.layerAGain, rateB, patternB, null);
    }

    return offlineCtx.startRendering();
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  /** Subscribe to isPlaying changes. Returns an unsubscribe fn. */
  subscribeIsPlaying(listener: (v: boolean) => void): () => void {
    this.playingListeners.add(listener);
    return () => { this.playingListeners.delete(listener); };
  }

  private emitPlaying() {
    for (const l of this.playingListeners) l(this.isPlaying);
  }

  // ─── Live mode API ──────────────────────────────────────────────────────────

  getContext(): AudioContext | null { return this.ctx; }
  getGraph(): BilateralGraph | null { return this.graph; }

  /** Override a param value for modulation (bypasses React state). */
  setModOverride<K extends keyof SynthParams>(key: K, value: SynthParams[K]) {
    this.modOverrides[key] = value;
  }

  clearModOverrides() {
    this.modOverrides = {};
  }

  /** Params as read by the scheduler: base merged with mod overrides. */
  private effectiveParams(): SynthParams {
    return { ...this.params, ...this.modOverrides } as SynthParams;
  }

  /**
   * Insert a FX rack between masterGain and destination.
   * Call with null to remove.
   */
  setFxRack(rack: FXRack | null) {
    if (!this.ctx) {
      this.fxRack = rack;
      return;
    }
    if (this.graph) {
      this.graph.masterGain.disconnect();
      if (rack) {
        this.graph.masterGain.connect(rack.input);
        rack.output.connect(this.analyserNode ?? (this.ctx.destination as unknown as AudioNode));
        if (this.analyserNode) this.analyserNode.connect(this.ctx.destination);
        if (this.streamDest) rack.output.connect(this.streamDest);
      } else {
        const dest = this.analyserNode ?? (this.ctx.destination as unknown as AudioNode);
        this.graph.masterGain.connect(dest);
        if (this.analyserNode) this.analyserNode.connect(this.ctx.destination);
        if (this.streamDest) this.graph.masterGain.connect(this.streamDest);
      }
    }
    this.fxRack = rack;
  }

  /** Create (or return existing) analyser node for envelope follower. */
  getOrCreateAnalyser(): AnalyserNode {
    if (!this.ctx) throw new Error("No audio context — start first");
    if (!this.analyserNode) {
      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 256;
    }
    return this.analyserNode;
  }

  /** Create a MediaStream from the output for live recording. */
  createStreamDest(): MediaStream {
    if (!this.ctx) throw new Error("No audio context — start first");
    this.streamDest = this.ctx.createMediaStreamDestination();
    const out = this.fxRack ? this.fxRack.output : this.graph?.masterGain;
    if (out) out.connect(this.streamDest);
    return this.streamDest.stream;
  }

  removeStreamDest() {
    if (this.streamDest) {
      try { this.streamDest.disconnect(); } catch {}
      this.streamDest = null;
    }
  }

  /** Scale the master gain (0–1, default 1). */
  setMasterVolume(volume: number) {
    if (!this.graph) return;
    const t = this.ctx?.currentTime ?? 0;
    this.graph.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), t, 0.01);
  }
}

export const audioEngine = new AudioEngine();
