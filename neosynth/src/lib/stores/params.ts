import { useState, useCallback, useEffect, createContext, useContext, createElement } from "react";
import type { ReactNode } from "react";
import type { SynthParams, BilateralPattern, CarrierType, PanMode } from "../audio/AudioEngine";
import { DEFAULT_PARAMS } from "../audio/AudioEngine";
import { loadPersisted, savePersistedDebounced } from "../utils/persist";

export type { BilateralPattern, CarrierType, PanMode, SynthParams };
export { DEFAULT_PARAMS };

export interface RatePreset {
  name: string;
  label: string;
  description: string;
  minRate: number;
  maxRate: number;
  defaultRate: number;
}

export const RATE_PRESETS: RatePreset[] = [
  {
    name: "delta",
    label: "Delta",
    description: "0.5–3 Hz · Deep sleep, healing",
    minRate: 0.5,
    maxRate: 3,
    defaultRate: 1,
  },
  {
    name: "theta",
    label: "Theta",
    description: "4–7 Hz · Meditation, creativity, REM",
    minRate: 4,
    maxRate: 7,
    defaultRate: 5,
  },
  {
    name: "alpha",
    label: "Alpha",
    description: "8–12 Hz · Relaxation, calm focus",
    minRate: 8,
    maxRate: 12,
    defaultRate: 10,
  },
  {
    name: "beta",
    label: "Beta",
    description: "13–30 Hz · Alert, active thinking",
    minRate: 13,
    maxRate: 30,
    defaultRate: 20,
  },
  {
    name: "emdr",
    label: "EMDR",
    description: "1–3 Hz · Standard EMDR therapy",
    minRate: 1,
    maxRate: 3,
    defaultRate: 2,
  },
];

export const PATTERN_INFO: Record<BilateralPattern, { label: string; description: string }> = {
  "pure-alternation": {
    label: "Pure Alternation",
    description: "Classic left-right alternating pulses",
  },
  "mirrored-overlap": {
    label: "Mirrored Overlap",
    description: "Simultaneous pulses followed by alternation",
  },
  asymmetric: {
    label: "Asymmetric",
    description: "Different rates and timing for each ear",
  },
  clustered: {
    label: "Clustered",
    description: "Bursts of rapid pulses with pauses",
  },
  randomized: {
    label: "Randomized",
    description: "Stochastic timing within defined bounds",
  },
  "ping-pong-sweep": {
    label: "Ping-Pong Sweep",
    description: "Continuous sine-wave panning L→R→L",
  },
  heartbeat: {
    label: "Heartbeat",
    description: "Lub-dub double pulse with long gap between pairs",
  },
  "bilateral-roll": {
    label: "Bilateral Roll",
    description: "Accelerating burst that speeds up then resets",
  },
};

export const CARRIER_INFO: Record<CarrierType, { label: string; description: string }> = {
  sine: {
    label: "Sine Tone",
    description: "Pure tone at adjustable frequency",
  },
  "pink-noise": {
    label: "Pink Noise",
    description: "Equal energy per octave",
  },
  "brown-noise": {
    label: "Brown Noise",
    description: "Deeper, rumbling low frequencies",
  },
  "band-limited": {
    label: "Band-Limited",
    description: "Filtered noise centered on carrier frequency",
  },
  sample: {
    label: "Sample",
    description: "Bundled or uploaded audio file as carrier",
  },
};

export interface BundledSample {
  slug: string;
  label: string;
  category: "percussion" | "bass" | "sfx" | "ambient";
  path: string;
}

export const BUNDLED_SAMPLES: BundledSample[] = [
  { slug: "sub-kick",     label: "Sub Kick",     category: "percussion", path: "/sounds/117493__zesoundresearchinc__kick-28-subwoofer-test.wav" },
  { slug: "laser",        label: "Laser",         category: "sfx",        path: "/sounds/232817__lezaarth__lasergun.wav" },
  { slug: "house-kick",   label: "House Kick",    category: "percussion", path: "/sounds/385874__waveplaysfx__kick-prog-house-kick.wav" },
  { slug: "kick",         label: "Kick",          category: "percussion", path: "/sounds/536545__angelkunev__hard-drum-kick-destroyer.wav" },
  { slug: "intercom",     label: "Intercom",      category: "sfx",        path: "/sounds/555140__fmaudio__lifting-up-intercom-phone.wav" },
  { slug: "paper-reload", label: "Paper Reload",  category: "sfx",        path: "/sounds/613291__birdofthenorth__paper-reload.wav" },
  { slug: "ouch",         label: "Ouch",          category: "sfx",        path: "/sounds/649543__ajanhallinta__ouch.wav" },
  { slug: "player-hurt",  label: "Player Hurt",   category: "sfx",        path: "/sounds/678594__redswan_studios__player-hurt-3.wav" },
  { slug: "music-box",    label: "Music Box",     category: "ambient",    path: "/sounds/731365__moodyfingers__hand-crank-music-box-cranking.wav" },
  { slug: "bass-loop",    label: "Bass Loop",     category: "bass",       path: "/sounds/798639__cvltiv8r__cvlt-bass-98.wav" },
];

export interface SessionPreset {
  name: string;
  label: string;
  description: string;
  params: Partial<SynthParams>;
}

export const SESSION_PRESETS: SessionPreset[] = [
  {
    name: "deep-sleep",
    label: "Deep Sleep",
    description: "Delta waves with warm brown noise for deep rest",
    params: {
      pattern: "pure-alternation",
      rate: 1,
      carrierType: "brown-noise",
      sampleUrl: null,
      layerBEnabled: false,
      attack: 0.15,
      decay: 0.3,
      dutyCycle: 0.6,
      leftGain: 0.7,
      rightGain: 0.7,
      panMode: "smooth",
    },
  },
  {
    name: "focus-flow",
    label: "Focus Flow",
    description: "Beta waves with sine tone for alert concentration",
    params: {
      pattern: "pure-alternation",
      rate: 20,
      carrierType: "sine",
      carrierFrequency: 200,
      sampleUrl: null,
      layerBEnabled: false,
      attack: 0.02,
      decay: 0.04,
      dutyCycle: 0.4,
      leftGain: 0.8,
      rightGain: 0.8,
      panMode: "hard",
    },
  },
  {
    name: "emdr-classic",
    label: "EMDR Classic",
    description: "Standard EMDR bilateral at 1.5 Hz with pure alternation",
    params: {
      pattern: "pure-alternation",
      rate: 1.5,
      carrierType: "sine",
      carrierFrequency: 300,
      sampleUrl: null,
      layerBEnabled: false,
      attack: 0.04,
      decay: 0.08,
      dutyCycle: 0.5,
      leftGain: 0.9,
      rightGain: 0.9,
      panMode: "hard",
    },
  },
  {
    name: "gamma-boost",
    label: "Gamma Boost",
    description: "High-beta clustered pulses for peak cognitive state",
    params: {
      pattern: "clustered",
      rate: 25,
      carrierType: "band-limited",
      carrierFrequency: 400,
      sampleUrl: null,
      layerBEnabled: true,
      layerBCarrierType: "pink-noise",
      layerBGain: 0.3,
      attack: 0.01,
      decay: 0.02,
      dutyCycle: 0.35,
      leftGain: 0.85,
      rightGain: 0.85,
      panMode: "hard",
      clusterBurstCount: 4,
      clusterBurstRate: 15,
      clusterPauseDuration: 0.3,
    },
  },
  {
    name: "drift",
    label: "Drift",
    description: "Theta randomized with pink noise for meditative float",
    params: {
      pattern: "randomized",
      rate: 5,
      carrierType: "pink-noise",
      sampleUrl: null,
      layerBEnabled: false,
      attack: 0.1,
      decay: 0.2,
      dutyCycle: 0.55,
      leftGain: 0.75,
      rightGain: 0.75,
      panMode: "smooth",
      randomMinInterval: 0.15,
      randomMaxInterval: 0.4,
    },
  },
  {
    name: "percussive-theta",
    label: "Percussive Theta",
    description: "Theta heartbeat pattern with kick drum carrier",
    params: {
      pattern: "heartbeat",
      rate: 5,
      carrierType: "sample",
      sampleUrl: "/sounds/536545__angelkunev__hard-drum-kick-destroyer.wav",
      layerAGain: 0.9,
      layerBEnabled: true,
      layerBCarrierType: "brown-noise",
      layerBGain: 0.25,
      attack: 0.01,
      decay: 0.05,
      dutyCycle: 0.3,
      leftGain: 0.9,
      rightGain: 0.9,
      panMode: "hard",
    },
  },
  {
    name: "sweep-alpha",
    label: "Sweep Alpha",
    description: "Alpha ping-pong sweep with sine + pink noise layers",
    params: {
      pattern: "ping-pong-sweep",
      rate: 10,
      carrierType: "sine",
      carrierFrequency: 180,
      sampleUrl: null,
      layerAGain: 0.8,
      layerBEnabled: true,
      layerBCarrierType: "pink-noise",
      layerBGain: 0.35,
      attack: 0.06,
      decay: 0.12,
      dutyCycle: 0.65,
      leftGain: 0.85,
      rightGain: 0.85,
      panMode: "smooth",
    },
  },
  {
    name: "bass-meditation",
    label: "Bass Meditation",
    description: "Deep delta bass loop with bilateral roll pattern",
    params: {
      pattern: "bilateral-roll",
      rate: 1.5,
      carrierType: "sample",
      sampleUrl: "/sounds/798639__cvltiv8r__cvlt-bass-98.wav",
      layerAGain: 0.85,
      layerBEnabled: false,
      attack: 0.08,
      decay: 0.15,
      dutyCycle: 0.5,
      leftGain: 0.8,
      rightGain: 0.8,
      panMode: "smooth",
    },
  },
];

export interface ExportParams {
  bitDepth: 16 | 24;
  durationSeconds: number;
}

export const DEFAULT_EXPORT_PARAMS: ExportParams = {
  bitDepth: 16,
  durationSeconds: 60,
};

export interface SynthParamsContextValue {
  params: SynthParams;
  setParams: (params: SynthParams) => void;
  updateParam: <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => void;
  exportParams: ExportParams;
  updateExportParam: <K extends keyof ExportParams>(key: K, value: ExportParams[K]) => void;
  activePreset: string | null;
  applyRatePreset: (preset: RatePreset) => void;
  activeSessionPreset: string | null;
  applySessionPreset: (preset: SessionPreset) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
}

const SynthParamsContext = createContext<SynthParamsContextValue | null>(null);

export function SynthParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<SynthParams>(() =>
    loadPersisted<SynthParams>("params", { ...DEFAULT_PARAMS }),
  );
  const [exportParams, setExportParams] = useState<ExportParams>(() =>
    loadPersisted<ExportParams>("exportParams", { ...DEFAULT_EXPORT_PARAMS }),
  );
  const [activePreset, setActivePreset] = useState<string | null>("theta");
  const [activeSessionPreset, setActiveSessionPreset] = useState<string | null>(null);
  const [masterVolume, setMasterVolume] = useState(() =>
    loadPersisted<number>("masterVolume", 1.0),
  );

  useEffect(() => { savePersistedDebounced("params", params); }, [params]);
  useEffect(() => { savePersistedDebounced("exportParams", exportParams); }, [exportParams]);
  useEffect(() => { savePersistedDebounced("masterVolume", masterVolume); }, [masterVolume]);

  const updateParam = useCallback(<K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setActiveSessionPreset(null);
    if (key === "rate") {
      setActivePreset(prev => {
        if (!prev) return prev;
        const preset = RATE_PRESETS.find(p => p.name === prev);
        if (!preset) return prev;
        const rate = value as number;
        return rate >= preset.minRate && rate <= preset.maxRate ? prev : null;
      });
    }
  }, []);

  const applyRatePreset = useCallback((preset: RatePreset) => {
    setActivePreset(preset.name);
    setParams(prev => ({ ...prev, rate: preset.defaultRate }));
    setActiveSessionPreset(null);
  }, []);

  const applySessionPreset = useCallback((preset: SessionPreset) => {
    setActiveSessionPreset(preset.name);
    setActivePreset(null);
    setParams(prev => ({ ...prev, ...preset.params }));
  }, []);

  const updateExportParam = useCallback(<K extends keyof ExportParams>(key: K, value: ExportParams[K]) => {
    setExportParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const value: SynthParamsContextValue = {
    params,
    setParams,
    updateParam,
    exportParams,
    updateExportParam,
    activePreset,
    applyRatePreset,
    activeSessionPreset,
    applySessionPreset,
    masterVolume,
    setMasterVolume,
  };

  return createElement(SynthParamsContext.Provider, { value }, children);
}

export function useSynthParams(): SynthParamsContextValue {
  const ctx = useContext(SynthParamsContext);
  if (!ctx) {
    throw new Error("useSynthParams must be used within a SynthParamsProvider");
  }
  return ctx;
}
