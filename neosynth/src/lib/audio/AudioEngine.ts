export type BilateralPattern =
  | "pure-alternation"
  | "mirrored-overlap"
  | "asymmetric"
  | "clustered"
  | "randomized";

export type CarrierType = "sine" | "pink-noise" | "brown-noise" | "band-limited";
export type PanMode = "hard" | "smooth";

export interface SynthParams {
  pattern: BilateralPattern;
  rate: number;
  carrierType: CarrierType;
  carrierFrequency: number;
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
}

export const DEFAULT_PARAMS: SynthParams = {
  pattern: "pure-alternation",
  rate: 4,
  carrierType: "sine",
  carrierFrequency: 200,
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

/**
 * Wraps the true source node (startable/stoppable) plus the output node
 * (may be a BiquadFilterNode for band-limited), so teardown always stops
 * the real source regardless of carrier type.
 */
interface CarrierPair {
  source: OscillatorNode | AudioBufferSourceNode;
  output: AudioNode;
}

function createCarrier(ctx: BaseAudioContext, params: SynthParams): CarrierPair {
  if (params.carrierType === "sine") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = params.carrierFrequency;
    osc.start(0);
    return { source: osc, output: osc };
  }

  const noiseType: "pink" | "brown" | "white" =
    params.carrierType === "pink-noise" ? "pink"
    : params.carrierType === "brown-noise" ? "brown"
    : "white";

  const buffer = createNoiseBuffer(ctx, noiseType);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start(0);

  if (params.carrierType === "band-limited") {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = params.carrierFrequency;
    filter.Q.value = 2;
    src.connect(filter);
    return { source: src, output: filter };
  }

  return { source: src, output: src };
}

/**
 * Bilateral audio graph using splitter/merger routing:
 *
 *   carrier.output → envGain → StereoPanner → ChannelSplitter(2)
 *                                               ├─ ch0 → leftLevel  ─┐
 *                                               └─ ch1 → rightLevel  ─┼→ ChannelMerger(2) → masterGain → destination
 *
 * Hard pan: panner.pan switches abruptly to -1 / 0 / +1 at each pulse
 * Smooth pan: panner.pan ramps linearly to the target position at each pulse
 * leftLevel / rightLevel apply independent per-ear gain regardless of panMode
 */
interface BilateralGraph {
  carrier: CarrierPair;
  envGain: GainNode;
  panner: StereoPannerNode;
  splitter: ChannelSplitterNode;
  leftLevel: GainNode;
  rightLevel: GainNode;
  merger: ChannelMergerNode;
  masterGain: GainNode;
}

function buildGraph(ctx: BaseAudioContext, params: SynthParams): BilateralGraph {
  const carrier = createCarrier(ctx, params);

  const envGain = ctx.createGain();
  envGain.gain.value = 0;

  const panner = ctx.createStereoPanner();
  panner.pan.value = -1;

  const splitter = ctx.createChannelSplitter(2);

  const leftLevel = ctx.createGain();
  leftLevel.gain.value = params.leftGain;
  const rightLevel = ctx.createGain();
  rightLevel.gain.value = params.rightGain;

  const merger = ctx.createChannelMerger(2);
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;

  carrier.output.connect(envGain);
  envGain.connect(panner);
  panner.connect(splitter);
  splitter.connect(leftLevel, 0);
  splitter.connect(rightLevel, 1);
  leftLevel.connect(merger, 0, 0);
  rightLevel.connect(merger, 0, 1);
  merger.connect(masterGain);

  return { carrier, envGain, panner, splitter, leftLevel, rightLevel, merger, masterGain };
}

function teardownGraph(graph: BilateralGraph) {
  try { graph.carrier.source.stop(); } catch {}
  graph.carrier.source.disconnect();
  if (graph.carrier.output !== graph.carrier.source) {
    graph.carrier.output.disconnect();
  }
  graph.envGain.disconnect();
  graph.panner.disconnect();
  graph.splitter.disconnect();
  graph.leftLevel.disconnect();
  graph.rightLevel.disconnect();
  graph.merger.disconnect();
  graph.masterGain.disconnect();
}

interface ChunkState {
  nextLeft: number;
  nextRight: number;
  side: "left" | "right";
}

interface ChunkResult {
  endTime: number;
  nextLeftTime: number;
  nextRightTime: number;
  nextSide: "left" | "right";
}

function scheduleChunk(
  _ctx: BaseAudioContext,
  graph: BilateralGraph,
  params: SynthParams,
  chunkStart: number,
  chunkDuration: number,
  state: ChunkState
): ChunkResult {
  const { attack, decay, dutyCycle, pattern, rate, panMode } = params;
  const chunkEnd = chunkStart + chunkDuration;
  let { side } = state;
  const interval = 1 / rate;
  const { envGain, panner } = graph;

  /**
   * Schedule the pulse gain envelope and pan position at time t.
   * Smooth mode ramps the panner to the target channel over the first
   * half of the pulse duration — tied to actual per-pulse channel events,
   * so asymmetric / clustered / randomized patterns stay in sync.
   */
  function schedulePulseAt(t: number, channel: "left" | "right" | "both", pulseDur: number) {
    envGain.gain.cancelScheduledValues(t);
    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(1, t + attack);
    const sustain = Math.max(0, pulseDur - attack - decay);
    envGain.gain.setValueAtTime(1, t + attack + sustain);
    envGain.gain.linearRampToValueAtTime(0, t + attack + sustain + decay);

    const targetPan = channel === "both" ? 0 : channel === "left" ? -1 : 1;
    if (panMode === "hard") {
      panner.pan.setValueAtTime(targetPan, t);
    } else {
      panner.pan.linearRampToValueAtTime(targetPan, t + Math.min(pulseDur * 0.5, interval * 0.4));
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side };
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side };
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
    return {
      endTime: Math.max(nextLeft, nextRight),
      nextLeftTime: nextLeft,
      nextRightTime: nextRight,
      nextSide: side,
    };
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side };
  }

  if (pattern === "randomized") {
    let t = Math.min(state.nextLeft, state.nextRight);
    while (t < chunkEnd) {
      const ri =
        params.randomMinInterval +
        Math.random() * (params.randomMaxInterval - params.randomMinInterval);
      schedulePulseAt(t, side, ri * dutyCycle);
      side = side === "left" ? "right" : "left";
      t += ri;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side };
  }

  return { endTime: chunkEnd, nextLeftTime: chunkEnd, nextRightTime: chunkEnd, nextSide: side };
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: BilateralGraph | null = null;
  private userAudioSource: AudioBufferSourceNode | null = null;
  private userAudioBuffer: AudioBuffer | null = null;
  private scheduleInterval: ReturnType<typeof setInterval> | null = null;
  private scheduleEnd = 0;
  private scheduleState: ChunkState = { nextLeft: 0, nextRight: 0, side: "left" };
  private isPlaying = false;
  private params: SynthParams = { ...DEFAULT_PARAMS };

  updateParams(newParams: SynthParams) {
    const prev = this.params;
    this.params = { ...newParams };

    if (!this.isPlaying || !this.ctx || !this.graph) return;

    const needsRebuild =
      newParams.carrierType !== prev.carrierType ||
      newParams.panMode !== prev.panMode;

    if (needsRebuild) {
      this.stop();
      void this.start();
      return;
    }

    this.graph.leftLevel.gain.setTargetAtTime(newParams.leftGain, this.ctx.currentTime, 0.01);
    this.graph.rightLevel.gain.setTargetAtTime(newParams.rightGain, this.ctx.currentTime, 0.01);

    if (newParams.carrierFrequency !== prev.carrierFrequency) {
      const { source } = this.graph.carrier;
      if (source instanceof OscillatorNode) {
        source.frequency.setTargetAtTime(newParams.carrierFrequency, this.ctx.currentTime, 0.01);
      }
      if (this.graph.carrier.output instanceof BiquadFilterNode) {
        this.graph.carrier.output.frequency.setTargetAtTime(newParams.carrierFrequency, this.ctx.currentTime, 0.01);
      }
    }
  }

  async setUserAudio(file: File) {
    if (!this.ctx) await this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    this.userAudioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
  }

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

    const graph = buildGraph(this.ctx!, this.params);
    this.graph = graph;

    if (this.userAudioBuffer) {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.userAudioBuffer;
      src.loop = true;
      src.connect(graph.masterGain);
      src.start();
      this.userAudioSource = src;
    }

    graph.masterGain.connect(this.ctx!.destination);

    const startOffset = this.ctx!.currentTime + 0.05;
    this.scheduleEnd = startOffset;
    this.scheduleState = { nextLeft: startOffset, nextRight: startOffset, side: "left" };
    this.runScheduler();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
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
        const result = scheduleChunk(
          this.ctx,
          this.graph,
          this.params,
          this.scheduleEnd,
          CHUNK_DURATION,
          this.scheduleState
        );
        this.scheduleState = {
          nextLeft: result.nextLeftTime,
          nextRight: result.nextRightTime,
          side: result.nextSide,
        };
        this.scheduleEnd = result.endTime;
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

    const graph = buildGraph(offlineCtx, params);
    graph.masterGain.connect(offlineCtx.destination);

    if (this.userAudioBuffer) {
      const src = offlineCtx.createBufferSource();
      src.buffer = this.userAudioBuffer;
      src.loop = true;
      src.connect(graph.masterGain);
      src.start(0);
    }

    const initState: ChunkState = { nextLeft: 0, nextRight: 0, side: "left" };
    scheduleChunk(offlineCtx, graph, params, 0, durationSeconds, initState);

    return offlineCtx.startRendering();
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

export const audioEngine = new AudioEngine();
