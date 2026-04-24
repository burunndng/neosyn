import {
  useState, useCallback, useEffect, useRef,
  createContext, useContext, createElement,
} from "react";
import type { ReactNode } from "react";

import { masterClock } from "../audio/MasterClock";
import type { ClockDivision } from "../audio/MasterClock";
import {
  LFO, StepSequencer, EnvelopeFollower,
  defaultLFOState, defaultSequencerState,
} from "../audio/ModulationSources";
import type { LFOState, SequencerState } from "../audio/ModulationSources";
import { FXRack, DEFAULT_FX_STATE } from "../audio/FXRack";
import type { FXState, PadId } from "../audio/FXRack";
import { liveRecorder } from "../audio/LiveRecorder";
import { audioEngine } from "../audio/AudioEngine";
import type { SynthParams } from "../audio/AudioEngine";
import { downloadBlob } from "../utils/wavExport";
import { loadPersisted, savePersistedDebounced } from "../utils/persist";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModSourceId = "lfo1" | "lfo2" | "seq" | "env" | "macro1" | "macro2" | "macro3" | "macro4";

export type ModDestId =
  | "rate" | "dutyCycle" | "attack" | "decay"
  | "carrierFrequency" | "layerBCarrierFrequency"
  | "layerAGain" | "layerBGain" | "leftGain" | "rightGain"
  | "hpfFreq" | "lpfFreq" | "delayTime" | "delayFeedback" | "delayWet" | "reverbWet"
  | "driveAmount" | "crushBits" | "widthAmount" | "gateDepth" | "pumpDepth" | "masterGain"
  | "macro1" | "macro2" | "macro3" | "macro4";

/** depth –1..+1, added to normalised source value to compute final offset */
export interface ModRouting {
  id: string;
  sourceId: ModSourceId;
  destId: ModDestId;
  depth: number;   // –1 to +1
  bypass: boolean;
}

export interface MacroAssignment {
  paramKey: string;
  minVal: number;
  maxVal: number;
}

export interface MacroConfig {
  id: "macro1" | "macro2" | "macro3" | "macro4";
  label: string;
  value: number;  // 0–1 (base, before mod matrix)
  assignments: MacroAssignment[];
}

export interface PatchSnapshot {
  label: string;
  synthParams: SynthParams;
  macros: MacroConfig[];
  lfo1: LFOState;
  lfo2: LFOState;
  seq: SequencerState;
  fx: FXState;
  bpm: number;
}

/** Auto-arrange scene: cycles through 4 snapshot slots on a bar counter. */
export interface Scene {
  /** Snapshot slot index (0–7) or null to freeze on current patch. */
  slots: [number | null, number | null, number | null, number | null];
  /** Bars spent on each slot before advancing. */
  barsPerSlot: number;
  /** Morph duration (in bars) at the end of each slot's window. */
  morphBars: number;
}

export const DEFAULT_SCENE: Scene = {
  slots: [null, null, null, null],
  barsPerSlot: 16,
  morphBars: 4,
};

// Mod destination specs: [range, min, max]
const DEST_SPEC: Record<ModDestId, [number, number, number]> = {
  rate:                    [29.5, 0.5,  30],
  dutyCycle:               [0.8,  0.1,  0.9],
  attack:                  [0.49, 0.01, 0.5],
  decay:                   [0.49, 0.01, 0.5],
  carrierFrequency:        [780,  20,   800],
  layerBCarrierFrequency:  [780,  20,   800],
  layerAGain:              [1,    0,    1],
  layerBGain:              [1,    0,    1],
  leftGain:                [1,    0,    1],
  rightGain:               [1,    0,    1],
  hpfFreq:                 [1980, 20,   2000],
  lpfFreq:                 [19800,200,  20000],
  delayTime:               [1.89, 0.01, 1.9],
  delayFeedback:           [0.95, 0,    0.95],
  delayWet:                [1,    0,    1],
  reverbWet:               [1,    0,    1],
  driveAmount:             [1,    0,    1],
  crushBits:               [11,   1,    12],
  widthAmount:             [2,    0,    2],
  gateDepth:               [1,    0,    1],
  pumpDepth:               [1,    0,    1],
  masterGain:              [1.5,  0,    1.5],
  macro1:                  [1,    0,    1],
  macro2:                  [1,    0,    1],
  macro3:                  [1,    0,    1],
  macro4:                  [1,    0,    1],
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function defaultMacros(): [MacroConfig, MacroConfig, MacroConfig, MacroConfig] {
  return [
    { id: "macro1", label: "Macro 1", value: 0.5, assignments: [] },
    { id: "macro2", label: "Macro 2", value: 0.5, assignments: [] },
    { id: "macro3", label: "Macro 3", value: 0.5, assignments: [] },
    { id: "macro4", label: "Macro 4", value: 0.5, assignments: [] },
  ];
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface LiveModeContextValue {
  isLiveMode: boolean;
  setIsLiveMode: (v: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;

  bpm: number;
  setBpm: (v: number) => void;
  tapTempo: () => void;

  lfo1: LFOState;
  updateLfo1: (patch: Partial<LFOState>) => void;
  lfo2: LFOState;
  updateLfo2: (patch: Partial<LFOState>) => void;

  seq: SequencerState;
  updateSeq: (patch: Partial<SequencerState>) => void;
  seqStep: number;   // current step (read-only, updated by control loop)

  modRoutings: ModRouting[];
  addRouting: (r: Omit<ModRouting, "id">) => void;
  updateRouting: (id: string, patch: Partial<ModRouting>) => void;
  removeRouting: (id: string) => void;
  clearAllRoutings: () => void;

  macros: [MacroConfig, MacroConfig, MacroConfig, MacroConfig];
  updateMacro: (idx: number, patch: Partial<MacroConfig>) => void;
  setMacroValue: (idx: number, value: number) => void;

  /** Live phase (0–1) of each LFO — read inside RAF, not stored in state. */
  getLfo1Phase: () => number;
  getLfo2Phase: () => number;

  fx: FXState;
  updateFx: (patch: Partial<FXState>) => void;
  triggerPad: (pad: PadId) => void;
  getMeterAnalyser: () => AnalyserNode | null;
  getStereoMeter: () => { l: AnalyserNode; r: AnalyserNode } | null;

  snapshots: (PatchSnapshot | null)[];
  saveSnapshot: (slot: number, label: string, synthParams: SynthParams) => void;
  recallSnapshot: (slot: number, morphTimeSec: number) => void;
  morphTime: number;
  setMorphTime: (v: number) => void;
  morphMode: boolean;
  setMorphMode: (v: boolean) => void;
  activeSnapshot: number | null;

  scene: Scene;
  updateScene: (patch: Partial<Scene>) => void;
  sceneArmed: boolean;
  setSceneArmed: (v: boolean) => void;
  sceneCurrentSlot: 0 | 1 | 2 | 3;
}

const LiveModeContext = createContext<LiveModeContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function LiveModeProvider({
  children,
  synthParams,
  setSynthParams,
}: {
  children: ReactNode;
  synthParams: SynthParams;
  setSynthParams: (p: SynthParams) => void;
}) {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isPlaying, setIsPlayingState] = useState(audioEngine.getIsPlaying());
  const [isRecording, setIsRecording] = useState(false);

  // Single source of truth for isPlaying: the AudioEngine. Subscribe so both
  // surfaces (classic + live) stay in sync when either toggles playback.
  useEffect(() => audioEngine.subscribeIsPlaying(setIsPlayingState), []);

  const setIsPlaying = useCallback((v: boolean) => {
    if (v) void audioEngine.start();
    else audioEngine.stop();
  }, []);
  const [bpm, setBpmState] = useState(() => {
    const stored = loadPersisted<number>("bpm", masterClock.bpm);
    masterClock.setBpm(stored);
    return stored;
  });
  const [lfo1, setLfo1] = useState<LFOState>(() =>
    loadPersisted<LFOState>("lfo1", defaultLFOState("lfo1")),
  );
  const [lfo2, setLfo2] = useState<LFOState>(() =>
    loadPersisted<LFOState>("lfo2", defaultLFOState("lfo2")),
  );
  const [seq, setSeq] = useState<SequencerState>(() =>
    loadPersisted<SequencerState>("seq", defaultSequencerState()),
  );
  const [seqStep, setSeqStep] = useState(0);
  const [modRoutings, setModRoutings] = useState<ModRouting[]>(() =>
    loadPersisted<ModRouting[]>("modRoutings", []),
  );
  const [macros, setMacros] = useState<[MacroConfig, MacroConfig, MacroConfig, MacroConfig]>(() =>
    loadPersisted<[MacroConfig, MacroConfig, MacroConfig, MacroConfig]>("macros", defaultMacros()),
  );
  const [fx, setFx] = useState<FXState>(() =>
    loadPersisted<FXState>("fx", DEFAULT_FX_STATE),
  );
  const [snapshots, setSnapshots] = useState<(PatchSnapshot | null)[]>(() =>
    loadPersisted<(PatchSnapshot | null)[]>("snapshots", Array(8).fill(null)),
  );
  const [morphTime, setMorphTime] = useState(() => loadPersisted<number>("morphTime", 2));
  const [morphMode, setMorphMode] = useState(false);
  const [activeSnapshot, setActiveSnapshot] = useState<number | null>(null);
  const [scene, setScene] = useState<Scene>(() => loadPersisted<Scene>("scene", DEFAULT_SCENE));
  const [sceneArmed, setSceneArmedState] = useState(false);
  const [sceneCurrentSlot, setSceneCurrentSlot] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => { savePersistedDebounced("bpm", bpm); }, [bpm]);
  useEffect(() => { savePersistedDebounced("lfo1", lfo1); }, [lfo1]);
  useEffect(() => { savePersistedDebounced("lfo2", lfo2); }, [lfo2]);
  useEffect(() => { savePersistedDebounced("seq", seq); }, [seq]);
  useEffect(() => { savePersistedDebounced("modRoutings", modRoutings); }, [modRoutings]);
  useEffect(() => { savePersistedDebounced("macros", macros); }, [macros]);
  useEffect(() => { savePersistedDebounced("fx", fx); }, [fx]);
  useEffect(() => { savePersistedDebounced("snapshots", snapshots); }, [snapshots]);
  useEffect(() => { savePersistedDebounced("morphTime", morphTime); }, [morphTime]);
  useEffect(() => { savePersistedDebounced("scene", scene); }, [scene]);

  // Refs for control loop (avoids stale closures)
  const lfo1Ref = useRef(new LFO(lfo1));
  const lfo2Ref = useRef(new LFO(lfo2));
  const seqRef = useRef(new StepSequencer(seq));
  const envRef = useRef(new EnvelopeFollower());
  const fxRackRef = useRef<FXRack | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const modRoutingsRef = useRef(modRoutings);
  const macrosRef = useRef(macros);
  const fxStateRef = useRef(fx);
  const synthParamsRef = useRef(synthParams);
  const morphRef = useRef<{
    from: SynthParams; to: SynthParams; startMs: number; durationMs: number;
  } | null>(null);

  // Scene auto-advance state (refs so controlLoop sees live values).
  const sceneRef = useRef(scene);
  const sceneArmedRef = useRef(sceneArmed);
  const sceneCurrentSlotRef = useRef<0 | 1 | 2 | 3>(0);
  const sceneBarAccumRef = useRef(0);       // bars accumulated on current slot
  const sceneMorphFiredRef = useRef(false); // has this slot's morph already fired?
  const snapshotsRef = useRef(snapshots);
  const recallSnapshotRef = useRef<((slot: number, morphSec: number) => void) | null>(null);

  // Keep refs in sync
  useEffect(() => { modRoutingsRef.current = modRoutings; }, [modRoutings]);
  useEffect(() => { macrosRef.current = macros; }, [macros]);
  useEffect(() => { fxStateRef.current = fx; }, [fx]);
  useEffect(() => { synthParamsRef.current = synthParams; }, [synthParams]);
  useEffect(() => { lfo1Ref.current.state = lfo1; }, [lfo1]);
  useEffect(() => { lfo2Ref.current.state = lfo2; }, [lfo2]);
  useEffect(() => { seqRef.current.state = seq; }, [seq]);
  useEffect(() => { sceneRef.current = scene; }, [scene]);
  useEffect(() => { sceneArmedRef.current = sceneArmed; }, [sceneArmed]);
  useEffect(() => { snapshotsRef.current = snapshots; }, [snapshots]);

  // Create / destroy FX rack when entering/leaving live mode
  useEffect(() => {
    if (!isLiveMode) {
      if (fxRackRef.current) {
        audioEngine.setFxRack(null);
        fxRackRef.current.destroy();
        fxRackRef.current = null;
      }
      return;
    }
    // Defer until AudioContext exists (user presses play)
  }, [isLiveMode]);

  // Ensure FX rack exists whenever playing in live mode
  useEffect(() => {
    if (!isLiveMode || !isPlaying) return;
    const ctx = audioEngine.getContext();
    if (!ctx) return;
    if (!fxRackRef.current) {
      const rack = new FXRack(ctx, fxStateRef.current);
      fxRackRef.current = rack;
      audioEngine.setFxRack(rack);
      const analyser = audioEngine.getOrCreateAnalyser();
      envRef.current.attach(analyser);
    }
  }, [isLiveMode, isPlaying]);

  // Apply FX state changes to the rack (also re-applied whenever BPM changes
  // so clock-synced delay time tracks tempo).
  useEffect(() => {
    if (fxRackRef.current) fxRackRef.current.applyState(fx);
  }, [fx, bpm]);

  // ─── Control loop ──────────────────────────────────────────────────────────

  const controlLoop = useCallback(() => {
    if (!isPlaying) return;

    const now = performance.now();
    const delta = Math.min((now - lastTickRef.current) / 1000, 0.1);
    lastTickRef.current = now;

    const bpmVal = masterClock.bpm;

    // Tick mod sources
    const lfo1Val = lfo1Ref.current.tick(delta, bpmVal);
    const lfo2Val = lfo2Ref.current.tick(delta, bpmVal);
    const seqResult = seqRef.current.tick(delta, bpmVal);
    const envVal = envRef.current.tick();

    if (seqResult.advanced) {
      setSeqStep(seqResult.step);
    }

    const macroVals = macrosRef.current.map((m) => m.value);

    // Sequencer value is silent (0) when the current step's gate is off.
    const sourceValues: Record<ModSourceId, number> = {
      lfo1: lfo1Val,
      lfo2: lfo2Val,
      seq: seqResult.gate ? seqResult.value : 0,
      env: envVal,
      macro1: macroVals[0],
      macro2: macroVals[1],
      macro3: macroVals[2],
      macro4: macroVals[3],
    };

    // Accumulate deltas per destination
    const deltas: Partial<Record<ModDestId, number>> = {};
    for (const r of modRoutingsRef.current) {
      if (r.bypass) continue;
      deltas[r.destId] = (deltas[r.destId] ?? 0) + (sourceValues[r.sourceId] ?? 0) * r.depth;
    }

    applyModulationDeltas(deltas, synthParamsRef.current, fxStateRef.current, macrosRef.current);
    applyFxModulationDeltas(deltas, fxStateRef.current, fxRackRef.current);

    // Re-schedule trance gate + sidechain pump ahead of the play cursor.
    if (fxRackRef.current) fxRackRef.current.tickRhythmicFX(bpmVal);

    // Handle snapshot morph
    if (morphRef.current) {
      const m = morphRef.current;
      const progress = Math.min(1, (now - m.startMs) / m.durationMs);
      const lerped = lerpSynthParams(m.from, m.to, progress);
      setSynthParams(lerped);
      if (progress >= 1) morphRef.current = null;
    }

    // Scene auto-advance: track bars, fire morph at (barsPerSlot - morphBars),
    // advance slot at barsPerSlot. Empty slots freeze on current patch.
    if (sceneArmedRef.current) {
      const sc = sceneRef.current;
      const secsPerBar = (60 / bpmVal) * 4;
      const barDelta = delta / secsPerBar;
      sceneBarAccumRef.current += barDelta;

      const morphTriggerBar = Math.max(0, sc.barsPerSlot - sc.morphBars);

      if (!sceneMorphFiredRef.current && sceneBarAccumRef.current >= morphTriggerBar) {
        const nextIdx = ((sceneCurrentSlotRef.current + 1) % 4) as 0 | 1 | 2 | 3;
        const nextSlot = sc.slots[nextIdx];
        if (nextSlot !== null && snapshotsRef.current[nextSlot] && recallSnapshotRef.current) {
          const morphSec = sc.morphBars * secsPerBar;
          recallSnapshotRef.current(nextSlot, morphSec);
        }
        sceneMorphFiredRef.current = true;
      }

      if (sceneBarAccumRef.current >= sc.barsPerSlot) {
        sceneBarAccumRef.current = 0;
        sceneMorphFiredRef.current = false;
        const nextIdx = ((sceneCurrentSlotRef.current + 1) % 4) as 0 | 1 | 2 | 3;
        sceneCurrentSlotRef.current = nextIdx;
        setSceneCurrentSlot(nextIdx);
      }
    }
  }, [isPlaying, setSynthParams]);

  // Start / stop control loop
  useEffect(() => {
    if (isLiveMode && isPlaying) {
      lastTickRef.current = performance.now();
      loopTimerRef.current = setInterval(controlLoop, 20);
    } else {
      if (loopTimerRef.current) {
        clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
      if (!isPlaying) audioEngine.clearModOverrides();
    }
    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, [isLiveMode, isPlaying, controlLoop]);

  // ─── Public API ────────────────────────────────────────────────────────────

  const setBpm = useCallback((v: number) => {
    masterClock.setBpm(v);
    setBpmState(masterClock.bpm);
  }, []);

  const tapTempo = useCallback(() => {
    const newBpm = masterClock.tap();
    setBpmState(newBpm);
  }, []);

  const updateLfo1 = useCallback((patch: Partial<LFOState>) => {
    setLfo1((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateLfo2 = useCallback((patch: Partial<LFOState>) => {
    setLfo2((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateSeq = useCallback((patch: Partial<SequencerState>) => {
    setSeq((prev) => ({ ...prev, ...patch }));
  }, []);

  const addRouting = useCallback((r: Omit<ModRouting, "id">) => {
    setModRoutings((prev) => {
      if (prev.length >= 8) return prev;
      return [...prev, { ...r, id: crypto.randomUUID() }];
    });
  }, []);

  const updateRouting = useCallback((id: string, patch: Partial<ModRouting>) => {
    setModRoutings((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const removeRouting = useCallback((id: string) => {
    setModRoutings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearAllRoutings = useCallback(() => {
    setModRoutings([]);
  }, []);

  const updateMacro = useCallback((idx: number, patch: Partial<MacroConfig>) => {
    setMacros((prev) => {
      const next = [...prev] as typeof prev;
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const setMacroValue = useCallback((idx: number, value: number) => {
    setMacros((prev) => {
      const next = [...prev] as typeof prev;
      next[idx] = { ...next[idx], value };
      // Apply macro assignments immediately
      for (const asgn of next[idx].assignments) {
        const mapped = asgn.minVal + value * (asgn.maxVal - asgn.minVal);
        audioEngine.setModOverride(asgn.paramKey as keyof SynthParams, mapped as never);
      }
      return next;
    });
  }, []);

  const updateFx = useCallback((patch: Partial<FXState>) => {
    setFx((prev) => ({ ...prev, ...patch }));
  }, []);

  const triggerPad = useCallback((pad: PadId) => {
    if (fxRackRef.current) {
      fxRackRef.current.triggerPad(pad, masterClock.bpm);
      liveRecorder.log("pad", { pad, bpm: masterClock.bpm });
    }
  }, []);

  const getMeterAnalyser = useCallback(() => {
    return fxRackRef.current?.meterAnalyser ?? null;
  }, []);

  const getStereoMeter = useCallback(() => {
    const rack = fxRackRef.current;
    if (!rack) return null;
    return { l: rack.meterAnalyserL, r: rack.meterAnalyserR };
  }, []);

  const saveSnapshot = useCallback((slot: number, label: string, sp: SynthParams) => {
    const snap: PatchSnapshot = {
      label,
      synthParams: { ...sp },
      macros: macrosRef.current.map((m) => ({ ...m, assignments: [...m.assignments] })) as typeof macros,
      lfo1: { ...lfo1Ref.current.state },
      lfo2: { ...lfo2Ref.current.state },
      seq: { ...seqRef.current.state },
      fx: { ...fxStateRef.current },
      bpm: masterClock.bpm,
    };
    setSnapshots((prev) => {
      const next = [...prev];
      next[slot] = snap;
      return next;
    });
    liveRecorder.log("snapshot-save", { slot, label });
  }, []);

  const recallSnapshot = useCallback((slot: number, morphTimeSec: number) => {
    setSnapshots((prev) => {
      const snap = prev[slot];
      if (!snap) return prev;

      liveRecorder.log("snapshot-recall", { slot, label: snap.label, morphTime: morphTimeSec });
      setActiveSnapshot(slot);

      if (morphTimeSec <= 0) {
        setSynthParams(snap.synthParams);
        setLfo1(snap.lfo1);
        setLfo2(snap.lfo2);
        setSeq(snap.seq);
        setFx(snap.fx);
        setMacros(snap.macros as typeof macros);
        masterClock.setBpm(snap.bpm);
        setBpmState(snap.bpm);
      } else {
        // Linear morph for synthParams; snap other state immediately
        morphRef.current = {
          from: { ...synthParamsRef.current },
          to: snap.synthParams,
          startMs: performance.now(),
          durationMs: morphTimeSec * 1000,
        };
        setLfo1(snap.lfo1);
        setLfo2(snap.lfo2);
        setSeq(snap.seq);
        setFx(snap.fx);
        setMacros(snap.macros as typeof macros);
        masterClock.setBpm(snap.bpm);
        setBpmState(snap.bpm);
      }
      return prev;
    });
  }, [setSynthParams]);

  // Expose recall to controlLoop via ref (breaks declaration-order dependency).
  useEffect(() => { recallSnapshotRef.current = recallSnapshot; }, [recallSnapshot]);

  // Scene API
  const updateScene = useCallback((patch: Partial<Scene>) => {
    setScene((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSceneArmed = useCallback((v: boolean) => {
    setSceneArmedState(v);
    if (!v) {
      sceneBarAccumRef.current = 0;
      sceneMorphFiredRef.current = false;
      sceneCurrentSlotRef.current = 0;
      setSceneCurrentSlot(0);
    }
  }, []);

  // Reset scene counters whenever transport stops.
  useEffect(() => {
    if (!isPlaying) {
      sceneBarAccumRef.current = 0;
      sceneMorphFiredRef.current = false;
    }
  }, [isPlaying]);

  // Recording
  const startRecording = useCallback(async () => {
    if (liveRecorder.isRecording) return;
    try {
      const stream = audioEngine.createStreamDest();
      liveRecorder.start(stream);
      setIsRecording(true);
      liveRecorder.log("record-start", { bpm: masterClock.bpm });
    } catch (e) {
      console.error("Failed to start recording:", e);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!liveRecorder.isRecording) return;
    const result = await liveRecorder.stop();
    audioEngine.removeStreamDest();
    setIsRecording(false);
    if (result) {
      const ext = result.audioBlob.type.includes("ogg") ? "ogg" : "webm";
      downloadBlob(result.audioBlob, `neosyn-live-${Date.now()}.${ext}`);
      const evtBlob = new Blob([result.eventsJson], { type: "application/json" });
      downloadBlob(evtBlob, `neosyn-live-${Date.now()}-events.json`);
    }
  }, []);

  const getLfo1Phase = useCallback(() => lfo1Ref.current.phase, []);
  const getLfo2Phase = useCallback(() => lfo2Ref.current.phase, []);

  const value: LiveModeContextValue = {
    isLiveMode, setIsLiveMode,
    isPlaying, setIsPlaying,
    isRecording, startRecording, stopRecording,
    bpm, setBpm, tapTempo,
    lfo1, updateLfo1,
    lfo2, updateLfo2,
    seq, updateSeq, seqStep,
    modRoutings, addRouting, updateRouting, removeRouting, clearAllRoutings,
    macros, updateMacro, setMacroValue,
    getLfo1Phase, getLfo2Phase,
    fx, updateFx, triggerPad, getMeterAnalyser, getStereoMeter,
    snapshots, saveSnapshot, recallSnapshot,
    morphTime, setMorphTime,
    morphMode, setMorphMode,
    activeSnapshot,
    scene, updateScene,
    sceneArmed, setSceneArmed,
    sceneCurrentSlot,
  };

  return createElement(LiveModeContext.Provider, { value }, children);
}

export function useLiveMode(): LiveModeContextValue {
  const ctx = useContext(LiveModeContext);
  if (!ctx) throw new Error("useLiveMode must be used inside LiveModeProvider");
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyModulationDeltas(
  deltas: Partial<Record<ModDestId, number>>,
  base: SynthParams,
  _fxBase: FXState,
  macros: MacroConfig[],
) {
  const ctx = audioEngine.getContext();
  const graph = audioEngine.getGraph();
  const TC = 0.008;

  for (const [destRaw, delta] of Object.entries(deltas)) {
    const dest = destRaw as ModDestId;
    const [range, min, max] = DEST_SPEC[dest];

    // Macro destinations: adjust macro value, then fire assignments
    if (dest === "macro1" || dest === "macro2" || dest === "macro3" || dest === "macro4") {
      const idx = parseInt(dest.slice(-1)) - 1;
      const effVal = clamp((macros[idx]?.value ?? 0.5) + delta * range, min, max);
      for (const asgn of (macros[idx]?.assignments ?? [])) {
        const mapped = asgn.minVal + effVal * (asgn.maxVal - asgn.minVal);
        audioEngine.setModOverride(asgn.paramKey as keyof SynthParams, mapped as never);
      }
      continue;
    }

    // Scheduler params (picked up on next chunk)
    if (dest === "rate" || dest === "dutyCycle" || dest === "attack" || dest === "decay") {
      const baseVal = base[dest as keyof SynthParams] as number;
      const modded = clamp(baseVal + delta * range, min, max);
      audioEngine.setModOverride(dest as keyof SynthParams, modded as never);
      continue;
    }

    // AudioParam destinations — require live AudioContext
    if (!ctx || !graph) continue;
    const t = ctx.currentTime;

    if (dest === "carrierFrequency") {
      const modded = clamp(base.carrierFrequency + delta * range, min, max);
      const src = graph.carrierA.source;
      if (src instanceof OscillatorNode) src.frequency.setTargetAtTime(modded, t, TC);
      if (graph.carrierA.output instanceof BiquadFilterNode) {
        (graph.carrierA.output as BiquadFilterNode).frequency.setTargetAtTime(modded, t, TC);
      }
      continue;
    }
    if (dest === "layerBCarrierFrequency" && graph.carrierB) {
      const modded = clamp(base.layerBCarrierFrequency + delta * range, min, max);
      const src = graph.carrierB.source;
      if (src instanceof OscillatorNode) src.frequency.setTargetAtTime(modded, t, TC);
      if (graph.carrierB.output instanceof BiquadFilterNode) {
        (graph.carrierB.output as BiquadFilterNode).frequency.setTargetAtTime(modded, t, TC);
      }
      continue;
    }
    if (dest === "layerAGain") {
      graph.layerAGain.gain.setTargetAtTime(clamp(base.layerAGain + delta * range, min, max), t, TC);
      continue;
    }
    if (dest === "layerBGain" && graph.layerBGain) {
      graph.layerBGain.gain.setTargetAtTime(clamp(base.layerBGain + delta * range, min, max), t, TC);
      continue;
    }
    if (dest === "leftGain") {
      graph.leftLevel.gain.setTargetAtTime(clamp(base.leftGain + delta * range, min, max), t, TC);
      continue;
    }
    if (dest === "rightGain") {
      graph.rightLevel.gain.setTargetAtTime(clamp(base.rightGain + delta * range, min, max), t, TC);
      continue;
    }
  }
}

function applyFxModulationDeltas(
  deltas: Partial<Record<ModDestId, number>>,
  fx: FXState,
  rack: FXRack | null,
) {
  if (!rack) return;
  const now = rack.input.context.currentTime;
  const TC = 0.012;

  for (const [destRaw, delta] of Object.entries(deltas)) {
    const dest = destRaw as ModDestId;
    const spec = DEST_SPEC[dest];
    if (!spec) continue;
    const [range, min, max] = spec;

    if (dest === "driveAmount") {
      const v = clamp(fx.driveAmount + delta * range, min, max);
      rack.applyState({ ...fx, driveAmount: v });
      continue;
    }
    if (dest === "crushBits") {
      const v = clamp(fx.crushBits + delta * range, min, max);
      rack.applyState({ ...fx, crushBits: v });
      continue;
    }
    if (dest === "widthAmount") {
      const v = clamp(fx.widthAmount + delta * range, min, max);
      rack.applyState({ ...fx, widthAmount: v });
      continue;
    }
    if (dest === "gateDepth") {
      const v = clamp(fx.gateDepth + delta * range, min, max);
      rack.applyState({ ...fx, gateDepth: v });
      continue;
    }
    if (dest === "pumpDepth") {
      const v = clamp(fx.pumpDepth + delta * range, min, max);
      rack.applyState({ ...fx, pumpDepth: v });
      continue;
    }
    if (dest === "masterGain") {
      const v = clamp(fx.masterGain + delta * range, min, max);
      rack.masterGainNode.gain.setTargetAtTime(v, now, TC);
      continue;
    }
  }
}

function lerpSynthParams(a: SynthParams, b: SynthParams, t: number): SynthParams {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    ...b,
    rate:                    lerp(a.rate, b.rate),
    carrierFrequency:        lerp(a.carrierFrequency, b.carrierFrequency),
    layerAGain:              lerp(a.layerAGain, b.layerAGain),
    layerBGain:              lerp(a.layerBGain, b.layerBGain),
    attack:                  lerp(a.attack, b.attack),
    decay:                   lerp(a.decay, b.decay),
    dutyCycle:               lerp(a.dutyCycle, b.dutyCycle),
    leftGain:                lerp(a.leftGain, b.leftGain),
    rightGain:               lerp(a.rightGain, b.rightGain),
    asymmetricLeftRate:      lerp(a.asymmetricLeftRate, b.asymmetricLeftRate),
    asymmetricRightRate:     lerp(a.asymmetricRightRate, b.asymmetricRightRate),
    layerBCarrierFrequency:  lerp(a.layerBCarrierFrequency, b.layerBCarrierFrequency),
    clusterBurstRate:        lerp(a.clusterBurstRate, b.clusterBurstRate),
    clusterPauseDuration:    lerp(a.clusterPauseDuration, b.clusterPauseDuration),
    randomMinInterval:       lerp(a.randomMinInterval, b.randomMinInterval),
    randomMaxInterval:       lerp(a.randomMaxInterval, b.randomMaxInterval),
    // discrete params snap at midpoint
    pattern:                 t < 0.5 ? a.pattern : b.pattern,
    carrierType:             t < 0.5 ? a.carrierType : b.carrierType,
    panMode:                 t < 0.5 ? a.panMode : b.panMode,
    layerBCarrierType:       t < 0.5 ? a.layerBCarrierType : b.layerBCarrierType,
    layerBEnabled:           t < 0.5 ? a.layerBEnabled : b.layerBEnabled,
    sampleUrl:               t < 0.5 ? a.sampleUrl : b.sampleUrl,
    layerBSampleUrl:         t < 0.5 ? a.layerBSampleUrl : b.layerBSampleUrl,
    clusterBurstCount:       t < 0.5 ? a.clusterBurstCount : b.clusterBurstCount,
  };
}
