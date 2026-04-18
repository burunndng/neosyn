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
  layerBEnabled: boolean;
  layerBCarrierType: CarrierType;
  layerBCarrierFrequency: number;
  layerBGain: number;
  layerBSampleUrl: string | null;
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
  sampleUrl: null,
  layerAGain: 1,
  layerBEnabled: false,
  layerBCarrierType: "pink-noise",
  layerBCarrierFrequency: 200,
  layerBGain: 0.5,
  layerBSampleUrl: null,
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
  envGain: GainNode;
  panner: StereoPannerNode;
  splitter: ChannelSplitterNode;
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
  const carrierA = createSynthCarrier(ctx, params.carrierType, params.carrierFrequency, sampleBufferA);

  const layerAGain = ctx.createGain();
  layerAGain.gain.value = params.layerAGain;

  const envGain = ctx.createGain();
  envGain.gain.value = 0;

  carrierA.output.connect(layerAGain);
  layerAGain.connect(envGain);

  let carrierB: CarrierPair | null = null;
  let layerBGainNode: GainNode | null = null;

  if (params.layerBEnabled) {
    carrierB = createSynthCarrier(ctx, params.layerBCarrierType, params.layerBCarrierFrequency, sampleBufferB);
    layerBGainNode = ctx.createGain();
    layerBGainNode.gain.value = params.layerBGain;
    carrierB.output.connect(layerBGainNode);
    layerBGainNode.connect(envGain);
  }

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

  envGain.connect(panner);
  panner.connect(splitter);
  splitter.connect(leftLevel, 0);
  splitter.connect(rightLevel, 1);
  leftLevel.connect(merger, 0, 0);
  rightLevel.connect(merger, 0, 1);
  merger.connect(masterGain);

  return {
    carrierA,
    carrierB,
    layerAGain,
    layerBGain: layerBGainNode,
    envGain,
    panner,
    splitter,
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
  rollPhase: number;
}

interface ChunkResult {
  endTime: number;
  nextLeftTime: number;
  nextRightTime: number;
  nextSide: "left" | "right";
  rollPhase: number;
}

function scheduleChunk(
  ctx: BaseAudioContext,
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0 };
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0 };
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
    return { endTime: Math.max(nextLeft, nextRight), nextLeftTime: nextLeft, nextRightTime: nextRight, nextSide: side, rollPhase: 0 };
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0 };
  }

  if (pattern === "randomized") {
    let t = Math.min(state.nextLeft, state.nextRight);
    while (t < chunkEnd) {
      const ri = params.randomMinInterval + Math.random() * (params.randomMaxInterval - params.randomMinInterval);
      schedulePulseAt(t, side, ri * dutyCycle);
      side = side === "left" ? "right" : "left";
      t += ri;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0 };
  }

  // Ping-Pong Sweep: continuous sine-wave panning, discrete envelope pulses
  if (pattern === "ping-pong-sweep") {
    let t = Math.min(state.nextLeft, state.nextRight);
    const pulseDur = interval * dutyCycle;
    // Schedule smooth panning as continuous sine wave over the chunk
    const sweepPeriod = 1 / rate;
    let sweepT = chunkStart;
    const steps = Math.ceil(chunkDuration / 0.02);
    for (let i = 0; i <= steps; i++) {
      const st = chunkStart + (i / steps) * chunkDuration;
      const elapsed = st - chunkStart + (chunkStart - (ctx?.currentTime ?? chunkStart));
      const phase = (2 * Math.PI * st) / sweepPeriod;
      panner.pan.linearRampToValueAtTime(Math.sin(phase), st);
      sweepT = st;
    }
    // Still pulse the envelope
    while (t < chunkEnd) {
      envGain.gain.cancelScheduledValues(t);
      envGain.gain.setValueAtTime(0, t);
      envGain.gain.linearRampToValueAtTime(1, t + attack);
      const sustain = Math.max(0, pulseDur - attack - decay);
      envGain.gain.setValueAtTime(1, t + attack + sustain);
      envGain.gain.linearRampToValueAtTime(0, t + attack + sustain + decay);
      t += interval;
    }
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: sweepT };
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase: 0 };
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
    return { endTime: t, nextLeftTime: t, nextRightTime: t, nextSide: side, rollPhase };
  }

  return { endTime: chunkEnd, nextLeftTime: chunkEnd, nextRightTime: chunkEnd, nextSide: side, rollPhase: 0 };
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
  private scheduleState: ChunkState = { nextLeft: 0, nextRight: 0, side: "left", rollPhase: 0 };
  private isPlaying = false;
  private params: SynthParams = { ...DEFAULT_PARAMS };

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
      newParams.layerBSampleUrl !== prev.layerBSampleUrl;

    if (needsRebuild) {
      this.stop();
      void this.start();
      return;
    }

    this.graph.leftLevel.gain.setTargetAtTime(newParams.leftGain, this.ctx.currentTime, 0.01);
    this.graph.rightLevel.gain.setTargetAtTime(newParams.rightGain, this.ctx.currentTime, 0.01);
    this.graph.layerAGain.gain.setTargetAtTime(newParams.layerAGain, this.ctx.currentTime, 0.01);
    if (this.graph.layerBGain) {
      this.graph.layerBGain.gain.setTargetAtTime(newParams.layerBGain, this.ctx.currentTime, 0.01);
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

  async previewSample(url: string): Promise<void> {
    await this.ensureContext();
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
    const src = this.ctx!.createBufferSource();
    src.buffer = decoded;
    src.connect(this.ctx!.destination);
    src.start(0);
    src.stop(this.ctx!.currentTime + 2);
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

    graph.masterGain.connect(this.ctx!.destination);

    const startOffset = this.ctx!.currentTime + 0.05;
    this.scheduleEnd = startOffset;
    this.scheduleState = { nextLeft: startOffset, nextRight: startOffset, side: "left", rollPhase: 0 };
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
          rollPhase: result.rollPhase,
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

    const initState: ChunkState = { nextLeft: 0, nextRight: 0, side: "left", rollPhase: 0 };
    scheduleChunk(offlineCtx, graph, params, 0, durationSeconds, initState);

    return offlineCtx.startRendering();
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

export const audioEngine = new AudioEngine();
