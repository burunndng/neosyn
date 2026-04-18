import { useState, useCallback, createContext, useContext, createElement } from "react";
import type { ReactNode } from "react";
import type { SynthParams, BilateralPattern, CarrierType, PanMode } from "../audio/AudioEngine";
import { DEFAULT_PARAMS } from "../audio/AudioEngine";

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
    description: "Classic left-right alternating pulses (EMDR standard)",
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
    description: "Bursts of rapid pulses with pauses between",
  },
  randomized: {
    label: "Randomized",
    description: "Stochastic timing within defined bounds",
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
};

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
}

const SynthParamsContext = createContext<SynthParamsContextValue | null>(null);

export function SynthParamsProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<SynthParams>({ ...DEFAULT_PARAMS });
  const [exportParams, setExportParams] = useState<ExportParams>({ ...DEFAULT_EXPORT_PARAMS });
  const [activePreset, setActivePreset] = useState<string | null>("theta");

  const updateParam = useCallback(<K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyRatePreset = useCallback((preset: RatePreset) => {
    setActivePreset(preset.name);
    setParams(prev => ({ ...prev, rate: preset.defaultRate }));
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
