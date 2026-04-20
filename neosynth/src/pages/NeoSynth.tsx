import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Slider } from "@/components/ui/slider";
import { BilateralField } from "@/components/BilateralField";
import { audioEngine } from "@/lib/audio/AudioEngine";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import {
  useSynthParams,
  RATE_PRESETS,
  PATTERN_INFO,
  CARRIER_INFO,
  BUNDLED_SAMPLES,
  SESSION_PRESETS,
} from "@/lib/stores/params";
import type { BilateralPattern, CarrierType } from "@/lib/audio/AudioEngine";
import { encodeWav, downloadBlob } from "@/lib/utils/wavExport";
import { ChevronDown, ChevronUp, Play, Square, Download, Upload, Zap } from "lucide-react";
import { useLiveMode } from "@/lib/stores/liveMode";

const DIVISION_MULTIPLIERS: Record<string, number> = {
  "1/1":  0.25,
  "1/2":  0.5,
  "1/4":  1,
  "1/8":  2,
  "1/16": 4,
  "1/4T": 4 / 3,
  "1/8T": 8 / 3,
};

export function NeoSynth() {
  const { params, updateParam, exportParams, updateExportParam, activePreset, applyRatePreset, activeSessionPreset, applySessionPreset, masterVolume, setMasterVolume } = useSynthParams();
  const { isLiveMode, setIsLiveMode, isPlaying, setIsPlaying } = useLiveMode();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [userFileName, setUserFileName] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [showEducation, setShowEducation] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [showSessionPresets, setShowSessionPresets] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [useBpmSync, setUseBpmSync] = useState(false);
  const [bpmValue, setBpmValue] = useState(120);
  const [bpmDivision, setBpmDivision] = useState<string>("1/4");
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isDragOverAudio, setIsDragOverAudio] = useState(false);
  const [exportPercent, setExportPercent] = useState(0);
  const exportCancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    exportCancelledRef.current = false;
    setIsExporting(true);
    setExportPercent(0);
    setExportProgress("Rendering 0%");

    // Approximate progress: offline render is ~5× real-time on modern hardware.
    const dur = exportParams.durationSeconds;
    const estimatedMs = Math.max(500, (dur / 5) * 1000);
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const pct = Math.min(95, Math.round((elapsed / estimatedMs) * 100));
      setExportPercent(pct);
      setExportProgress(`Rendering ${pct}%`);
    }, 120);

    try {
      const buffer = await audioEngine.renderOffline(params, exportParams.durationSeconds, exportParams.bitDepth);
      clearInterval(timer);
      if (exportCancelledRef.current) {
        setExportProgress("Cancelled");
        setTimeout(() => setExportProgress(""), 1500);
        return;
      }
      setExportPercent(98);
      setExportProgress("Encoding WAV...");
      const blob = encodeWav(buffer, exportParams.bitDepth);
      if (exportCancelledRef.current) {
        setExportProgress("Cancelled");
        setTimeout(() => setExportProgress(""), 1500);
        return;
      }
      const label = dur >= 60 ? `${dur / 60}min` : `${dur}s`;
      downloadBlob(blob, `neosynth-${params.pattern}-${params.rate}hz-${label}.wav`);
      setExportPercent(100);
      setExportProgress("Done");
      setTimeout(() => setExportProgress(""), 2000);
    } catch (e) {
      clearInterval(timer);
      setExportProgress("Error");
      setTimeout(() => setExportProgress(""), 3000);
    } finally {
      setIsExporting(false);
    }
  }, [params, exportParams, isExporting]);

  const handleCancelExport = useCallback(() => {
    exportCancelledRef.current = true;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target && target.isContentEditable)
      ) {
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case "e":
        case "E":
          e.preventDefault();
          handleExport();
          break;
        case "l":
        case "L":
          e.preventDefault();
          setIsLiveMode(!isLiveMode);
          break;
        case "?":
          e.preventDefault();
          setShowHelp(!showHelp);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying, isLiveMode, setIsLiveMode, showHelp, handleExport]);

  useEffect(() => {
    audioEngine.updateParams(params);
  }, [params]);

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioError(null);
    setIsLoadingAudio(true);
    try {
      await audioEngine.setUserAudio(file);
      setUserFileName(file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load audio file";
      setAudioError(msg);
      setTimeout(() => setAudioError(null), 3000);
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  const handleAudioDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverAudio(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/") && !["audio/wav", "audio/mp3", "audio/mpeg"].includes(file.type)) {
      setAudioError("Please drop an audio file (WAV, MP3, etc.)");
      setTimeout(() => setAudioError(null), 3000);
      return;
    }
    setAudioError(null);
    setIsLoadingAudio(true);
    try {
      await audioEngine.setUserAudio(file);
      setUserFileName(file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load audio file";
      setAudioError(msg);
      setTimeout(() => setAudioError(null), 3000);
    } finally {
      setIsLoadingAudio(false);
    }
  }, []);

  const handleSampleSelect = useCallback(async (path: string, layer: "A" | "B") => {
    if (layer === "A") {
      updateParam("carrierType", "sample");
      updateParam("sampleUrl", path);
    } else {
      updateParam("layerBCarrierType", "sample");
      updateParam("layerBSampleUrl", path);
    }
    if (isPlaying) {
      await audioEngine.loadSampleUrl(path, layer);
    }
  }, [isPlaying, updateParam]);

  const handlePreviewSample = useCallback(async (path: string) => {
    await audioEngine.previewSample(path);
  }, []);

  const DURATION_OPTIONS = [
    { label: "30s", value: 30 },
    { label: "1 min", value: 60 },
    { label: "2 min", value: 120 },
    { label: "5 min", value: 300 },
    { label: "10 min", value: 600 },
  ];

  const showAsymmetric = params.pattern === "asymmetric";
  const showClustered = params.pattern === "clustered";
  const showRandomized = params.pattern === "randomized";
  const showSineFreq = (params.carrierType === "sine" || params.carrierType === "band-limited");
  const showLayerBSineFreq = (params.layerBCarrierType === "sine" || params.layerBCarrierType === "band-limited");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#06070b", fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <header
        className="flex items-center px-4 py-2 shrink-0"
        style={{ background: "#0e1016", borderBottom: "1px solid rgba(255,255,255,0.05)", height: 40 }}
        data-testid="header"
      >
        <span
          className={`w-2.5 h-2.5 rounded-full mr-3 shrink-0${isPlaying ? " led-playing" : ""}`}
          style={{
            background: isPlaying ? "hsl(192,87%,53%)" : "rgba(34,211,238,0.35)",
            boxShadow: isPlaying ? "0 0 6px hsl(192,87%,53%)" : "none",
          }}
          data-testid="status-led"
        />
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "hsl(192,87%,53%)", letterSpacing: "0.18em" }}>
          NeoSynth
        </span>
        <span className="mx-3 text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>—</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.38)", letterSpacing: "0.06em" }}>
          Bilateral Isochronic Audio Synthesizer
        </span>
        <div className="ml-auto flex gap-3 items-center">
          {isPlaying && (
            <span className="text-xs" style={{ color: "hsl(192,87%,53%)", opacity: 0.9 }}>
              {params.rate.toFixed(1)} Hz
            </span>
          )}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>VOL</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              style={{
                width: 80,
                accentColor: "hsl(192,87%,53%)",
              }}
              title={`Master Volume: ${Math.round(masterVolume * 100)}%`}
            />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", minWidth: 20 }}>
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
          <button
            onClick={() => setIsLiveMode(!isLiveMode)}
            className="p-1.5 rounded transition-all"
            style={{
              background: isLiveMode ? "rgba(34,211,238,0.15)" : "transparent",
              border: `1px solid ${isLiveMode ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.1)"}`,
              color: isLiveMode ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.4)",
            }}
            title="Toggle Live Modular Mode (⚡)"
            aria-label="Toggle Live Modular Mode"
            aria-pressed={isLiveMode}
          >
            <Zap size={14} />
          </button>
        </div>
      </header>

      {/* Main three-column layout */}
      <div className="flex flex-1 gap-0 overflow-hidden neosynth-columns" style={{ minHeight: 0 }}>

        {/* LEFT COLUMN — Pattern & Carrier */}
        <aside
          className="flex flex-col gap-4 p-4 overflow-y-auto shrink-0 neosynth-aside neosynth-aside-left"
          style={{
            width: 220,
            background: "#0e1016",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
          data-testid="left-panel"
        >
          {/* Session Presets */}
          <Section label="SESSION PRESETS">
            <button
              onClick={() => setShowSessionPresets(!showSessionPresets)}
              className="w-full text-left px-2 py-1.5 rounded text-xs transition-all"
              style={{
                background: showSessionPresets ? "rgba(34,211,238,0.1)" : "transparent",
                border: `1px solid ${showSessionPresets ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                color: showSessionPresets ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.65)",
              }}
            >
              {activeSessionPreset ? SESSION_PRESETS.find(p => p.name === activeSessionPreset)?.label || "Browse" : "Browse"}
            </button>
            {showSessionPresets && (
              <div className="flex flex-col gap-1 mt-2 max-h-40 overflow-y-auto">
                {SESSION_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      applySessionPreset(preset);
                      setShowSessionPresets(false);
                    }}
                    className="text-left px-2 py-1 rounded text-xs transition-all"
                    style={{
                      background: activeSessionPreset === preset.name ? "rgba(34,211,238,0.15)" : "transparent",
                      border: `1px solid ${activeSessionPreset === preset.name ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.05)"}`,
                      color: activeSessionPreset === preset.name ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    <div className="text-xs" style={{ fontSize: 9 }}>{preset.label}</div>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Pattern */}
          <Section label="PATTERN">
            <div className="flex flex-col gap-1">
              {(Object.keys(PATTERN_INFO) as BilateralPattern[]).map((p) => (
                <button
                  key={p}
                  data-testid={`pattern-${p}`}
                  onClick={() => updateParam("pattern", p)}
                  className="text-left px-2 py-1.5 rounded transition-all"
                  style={{
                    background: params.pattern === p ? "rgba(34,211,238,0.1)" : "transparent",
                    border: `1px solid ${params.pattern === p ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: params.pattern === p ? "0 0 8px rgba(34,211,238,0.15)" : "none",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: params.pattern === p ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.75)" }}>
                    {PATTERN_INFO[p].label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.28)", lineHeight: 1.3, fontSize: 9 }}>
                    {PATTERN_INFO[p].description}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Rate Presets */}
          <Section label="RATE PRESET">
            <div className="flex flex-col gap-1">
              {RATE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  data-testid={`preset-${preset.name}`}
                  onClick={() => applyRatePreset(preset)}
                  className="text-left px-2 py-1.5 rounded transition-all"
                  style={{
                    background: activePreset === preset.name ? "rgba(34,211,238,0.1)" : "transparent",
                    border: `1px solid ${activePreset === preset.name ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                    boxShadow: activePreset === preset.name ? "0 0 8px rgba(34,211,238,0.15)" : "none",
                  }}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold" style={{ color: activePreset === preset.name ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.75)" }}>
                      {preset.label}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 9 }}>
                      {preset.minRate}–{preset.maxRate} Hz
                    </span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, lineHeight: 1.3 }}>
                    {preset.description.split("·")[1]?.trim()}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Rate Slider / BPM Sync */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.15em" }}>
                RATE — {params.rate.toFixed(2)} HZ
              </div>
              <button
                onClick={() => setUseBpmSync(!useBpmSync)}
                className="px-2 py-0.5 rounded text-xs transition-all"
                style={{
                  background: useBpmSync ? "rgba(34,211,238,0.15)" : "transparent",
                  border: `1px solid ${useBpmSync ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: useBpmSync ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.4)",
                  fontSize: 10,
                  fontWeight: 600,
                }}
                title="Toggle BPM sync mode"
              >
                {useBpmSync ? "SYNC" : "FREE"}
              </button>
            </div>

            {useBpmSync ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                      BPM
                    </label>
                    <input
                      type="number"
                      min={20} max={300} step={1}
                      value={bpmValue}
                      onChange={(e) => {
                        const bpm = parseFloat(e.target.value);
                        if (!isNaN(bpm)) {
                          setBpmValue(bpm);
                          const hz = (bpm / 60) * DIVISION_MULTIPLIERS[bpmDivision];
                          updateParam("rate", hz);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        borderRadius: 3,
                        border: "1px solid rgba(34,211,238,0.3)",
                        background: "rgba(34,211,238,0.05)",
                        color: "hsl(192,87%,53%)",
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                      DIV
                    </label>
                    <select
                      value={bpmDivision}
                      onChange={(e) => {
                        const div = e.target.value;
                        setBpmDivision(div);
                        const hz = (bpmValue / 60) * DIVISION_MULTIPLIERS[div];
                        updateParam("rate", hz);
                      }}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        borderRadius: 3,
                        border: "1px solid rgba(34,211,238,0.3)",
                        background: "rgba(34,211,238,0.05)",
                        color: "hsl(192,87%,53%)",
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {CLOCK_DIVISIONS.map((div) => (
                        <option key={div} value={div}>
                          {div}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <Slider
                min={0.5}
                max={30}
                step={0.1}
                value={[params.rate]}
                onValueChange={([v]) => updateParam("rate", v)}
                data-testid="slider-rate"
                className="mt-1"
              />
            )}
          </div>
        </aside>

        {/* CENTER COLUMN — Bilateral Field + Transport */}
        <main
          className="flex flex-col flex-1 items-center justify-between p-5 gap-4 neosynth-center"
          style={{
            background: "#08090e",
            borderLeft: "1px solid rgba(34,211,238,0.15)",
            borderRight: "1px solid rgba(34,211,238,0.15)",
          }}
          data-testid="center-panel"
        >
          {/* Field visualization */}
          <div
            className="w-full flex-1 rounded flex items-center justify-center relative"
            style={{
              background: "#0b0d14",
              border: "1px solid rgba(34,211,238,0.2)",
              boxShadow: isPlaying ? "0 0 20px rgba(34,211,238,0.08), inset 0 0 40px rgba(34,211,238,0.03)" : "none",
              maxHeight: 280,
              minHeight: 180,
            }}
            data-testid="field-container"
          >
            <BilateralField isPlaying={isPlaying} rate={params.rate} pattern={params.pattern} />

            {/* Rate indicator overlay */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <span className="text-xs" style={{ color: "rgba(34,211,238,0.45)", letterSpacing: "0.12em" }}>
                {params.rate.toFixed(2)} Hz · {PATTERN_INFO[params.pattern].label}
              </span>
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              data-testid="button-play-stop"
              onClick={handlePlay}
              className="w-full flex items-center justify-center gap-2 py-3 rounded font-semibold text-sm tracking-widest uppercase transition-all"
              style={{
                background: isPlaying ? "rgba(34,211,238,0.15)" : "rgba(34,211,238,0.08)",
                border: `1px solid ${isPlaying ? "rgba(34,211,238,0.6)" : "rgba(34,211,238,0.25)"}`,
                color: "hsl(192,87%,53%)",
                boxShadow: isPlaying ? "0 0 12px rgba(34,211,238,0.3), inset 0 0 20px rgba(34,211,238,0.05)" : "0 0 4px rgba(34,211,238,0.1)",
                letterSpacing: "0.15em",
              }}
            >
              {isPlaying ? (
                <><Square size={14} strokeWidth={2.5} /> Stop</>
              ) : (
                <><Play size={14} strokeWidth={2.5} /> Play</>
              )}
            </button>

            {isExporting ? (
              <div
                className="w-full flex flex-col gap-1.5 py-2 px-3 rounded"
                style={{
                  border: "1px solid rgba(34,211,238,0.3)",
                  background: "rgba(34,211,238,0.05)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs tracking-widest uppercase" style={{ color: "hsl(192,87%,53%)", fontSize: 10, letterSpacing: "0.12em" }}>
                    {exportProgress || "Rendering..."}
                  </span>
                  <button
                    onClick={handleCancelExport}
                    className="px-2 py-0.5 rounded"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      color: "#ef4444",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                    }}
                  >
                    CANCEL
                  </button>
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${exportPercent}%`,
                      background: "hsl(192,87%,53%)",
                      transition: "width 120ms linear",
                    }}
                  />
                </div>
              </div>
            ) : (
              <button
                data-testid="button-export-wav"
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm tracking-widest uppercase transition-all"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}
              >
                <Download size={13} strokeWidth={2} />
                Export WAV
              </button>
            )}
          </div>

          {/* Field legend */}
          <div className="flex gap-6 items-center">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
              LEFT
            </span>
            <div className="h-px w-20" style={{ background: "linear-gradient(to right, rgba(34,211,238,0.4), rgba(34,211,238,0.1))" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.12)", fontSize: 10 }}>
              BILATERAL FIELD
            </span>
            <div className="h-px w-20" style={{ background: "linear-gradient(to left, rgba(34,211,238,0.4), rgba(34,211,238,0.1))" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
              RIGHT
            </span>
          </div>
        </main>

        {/* RIGHT COLUMN — Carriers, Envelope, Export */}
        <aside
          className="flex flex-col gap-4 p-4 overflow-y-auto shrink-0 neosynth-aside neosynth-aside-right"
          style={{
            width: 240,
            background: "#0e1016",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
          data-testid="right-panel"
        >
          {/* Layer A Carrier */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.15em" }}>
                LAYER A CARRIER
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    updateParam("layerAMuted", !params.layerAMuted);
                    if (params.soloLayer === "A") updateParam("soloLayer", null);
                  }}
                  className="px-2 py-0.5 rounded text-xs transition-all"
                  style={{
                    background: params.layerAMuted ? "rgba(239,68,68,0.15)" : "transparent",
                    border: `1px solid ${params.layerAMuted ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: params.layerAMuted ? "#ef4444" : "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                  title="Mute Layer A"
                >
                  {params.layerAMuted ? "✕" : "M"}
                </button>
                <button
                  onClick={() => updateParam("soloLayer", params.soloLayer === "A" ? null : "A")}
                  className="px-2 py-0.5 rounded text-xs transition-all"
                  style={{
                    background: params.soloLayer === "A" ? "rgba(34,211,238,0.15)" : "transparent",
                    border: `1px solid ${params.soloLayer === "A" ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: params.soloLayer === "A" ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                  title="Solo Layer A"
                >
                  S
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                {(Object.keys(CARRIER_INFO) as CarrierType[]).map((c) => (
                  <button
                    key={c}
                    data-testid={`carrier-${c}`}
                    onClick={() => updateParam("carrierType", c)}
                    className="text-left px-2 py-1.5 rounded transition-all"
                    style={{
                      background: params.carrierType === c ? "rgba(34,211,238,0.1)" : "transparent",
                      border: `1px solid ${params.carrierType === c ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <div className="text-xs" style={{ color: params.carrierType === c ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.65)", fontSize: 10 }}>
                      {CARRIER_INFO[c].label}
                    </div>
                  </button>
                ))}
              </div>

              {showSineFreq && (
                <SliderRow
                  label={`FREQ`}
                  value={params.carrierFrequency}
                  display={`${params.carrierFrequency} Hz`}
                  min={20} max={800} step={1}
                  onChange={(v) => updateParam("carrierFrequency", v)}
                  testId="slider-carrier-freq"
                />
              )}

              {params.carrierType === "sample" && (
                <SamplePicker
                  label="SELECT SAMPLE"
                  selectedUrl={params.sampleUrl}
                  onSelect={(path) => handleSampleSelect(path, "A")}
                  onPreview={handlePreviewSample}
                />
              )}

              <SliderRow
                label="GAIN"
                value={params.layerAGain}
                display={`${Math.round(params.layerAGain * 100)}`}
                min={0} max={1} step={0.01}
                onChange={(v) => updateParam("layerAGain", v)}
                testId="slider-layer-a-gain"
              />
            </div>
          </div>

          {/* Layer B Toggle */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.15em" }}>
                LAYER B
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    updateParam("layerBMuted", !params.layerBMuted);
                    if (params.soloLayer === "B") updateParam("soloLayer", null);
                  }}
                  className="px-2 py-0.5 rounded text-xs transition-all"
                  style={{
                    background: params.layerBMuted ? "rgba(239,68,68,0.15)" : "transparent",
                    border: `1px solid ${params.layerBMuted ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: params.layerBMuted ? "#ef4444" : "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                  title="Mute Layer B"
                  disabled={!params.layerBEnabled}
                >
                  {params.layerBMuted ? "✕" : "M"}
                </button>
                <button
                  onClick={() => updateParam("soloLayer", params.soloLayer === "B" ? null : "B")}
                  className="px-2 py-0.5 rounded text-xs transition-all"
                  style={{
                    background: params.soloLayer === "B" ? "rgba(34,211,238,0.15)" : "transparent",
                    border: `1px solid ${params.soloLayer === "B" ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: params.soloLayer === "B" ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 600,
                    opacity: params.layerBEnabled ? 1 : 0.5,
                  }}
                  title="Solo Layer B"
                  disabled={!params.layerBEnabled}
                >
                  S
                </button>
              </div>
            </div>
            <button
              onClick={() => updateParam("layerBEnabled", !params.layerBEnabled)}
              className="w-full px-2 py-1.5 rounded text-xs transition-all"
              style={{
                background: params.layerBEnabled ? "rgba(34,211,238,0.1)" : "transparent",
                border: `1px solid ${params.layerBEnabled ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                color: params.layerBEnabled ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.45)",
              }}
            >
              {params.layerBEnabled ? "ENABLED" : "DISABLED"}
            </button>

            {params.layerBEnabled && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex flex-col gap-1">
                  {(Object.keys(CARRIER_INFO) as CarrierType[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => updateParam("layerBCarrierType", c)}
                      className="text-left px-2 py-1.5 rounded transition-all"
                      style={{
                        background: params.layerBCarrierType === c ? "rgba(34,211,238,0.1)" : "transparent",
                        border: `1px solid ${params.layerBCarrierType === c ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div className="text-xs" style={{ color: params.layerBCarrierType === c ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.65)", fontSize: 10 }}>
                        {CARRIER_INFO[c].label}
                      </div>
                    </button>
                  ))}
                </div>

                {showLayerBSineFreq && (
                  <SliderRow
                    label={`FREQ`}
                    value={params.layerBCarrierFrequency}
                    display={`${params.layerBCarrierFrequency} Hz`}
                    min={20} max={800} step={1}
                    onChange={(v) => updateParam("layerBCarrierFrequency", v)}
                    testId="slider-layer-b-freq"
                  />
                )}

                {params.layerBCarrierType === "sample" && (
                  <SamplePicker
                    label="SELECT SAMPLE"
                    selectedUrl={params.layerBSampleUrl}
                    onSelect={(path) => handleSampleSelect(path, "B")}
                    onPreview={handlePreviewSample}
                  />
                )}

                <SliderRow
                  label="GAIN"
                  value={params.layerBGain}
                  display={`${Math.round(params.layerBGain * 100)}`}
                  min={0} max={1} step={0.01}
                  onChange={(v) => updateParam("layerBGain", v)}
                  testId="slider-layer-b-gain"
                />
              </div>
            )}
          </div>

          {/* Pulse Envelope */}
          <Section label="ENVELOPE">
            <SliderRow
              label={`ATTACK`}
              value={params.attack}
              display={`${params.attack.toFixed(2)}s`}
              min={0.01} max={0.5} step={0.01}
              onChange={(v) => updateParam("attack", v)}
              testId="slider-attack"
            />
            <SliderRow
              label={`DECAY`}
              value={params.decay}
              display={`${params.decay.toFixed(2)}s`}
              min={0.01} max={0.5} step={0.01}
              onChange={(v) => updateParam("decay", v)}
              testId="slider-decay"
            />
            <SliderRow
              label={`DUTY`}
              value={params.dutyCycle}
              display={`${Math.round(params.dutyCycle * 100)}%`}
              min={0.1} max={0.9} step={0.01}
              onChange={(v) => updateParam("dutyCycle", v)}
              testId="slider-duty"
            />
          </Section>

          {/* Channel Gains */}
          <Section label="CHANNELS">
            <SliderRow
              label="LEFT"
              value={params.leftGain}
              display={`${Math.round(params.leftGain * 100)}`}
              min={0} max={1} step={0.01}
              onChange={(v) => updateParam("leftGain", v)}
              testId="slider-left-gain"
            />
            <SliderRow
              label="RIGHT"
              value={params.rightGain}
              display={`${Math.round(params.rightGain * 100)}`}
              min={0} max={1} step={0.01}
              onChange={(v) => updateParam("rightGain", v)}
              testId="slider-right-gain"
            />
          </Section>

          {/* Pan Mode */}
          <Section label="PAN MODE">
            <div className="flex gap-2">
              {(["hard", "smooth"] as const).map((mode) => (
                <button
                  key={mode}
                  data-testid={`pan-mode-${mode}`}
                  onClick={() => updateParam("panMode", mode)}
                  className="flex-1 py-1.5 rounded text-xs uppercase tracking-widest transition-all"
                  style={{
                    background: params.panMode === mode ? "rgba(34,211,238,0.12)" : "transparent",
                    border: `1px solid ${params.panMode === mode ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.08)"}`,
                    color: params.panMode === mode ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.45)",
                    letterSpacing: "0.1em",
                    fontSize: 10,
                  }}
                >
                  {mode === "hard" ? "Hard L/R" : "Smooth"}
                </button>
              ))}
            </div>
          </Section>

          {/* Pattern-specific options */}
          {showAsymmetric && (
            <Section label="ASYMMETRIC">
              <SliderRow label="L RATE" value={params.asymmetricLeftRate} display={`${params.asymmetricLeftRate.toFixed(1)} Hz`}
                min={0.5} max={15} step={0.1} onChange={(v) => updateParam("asymmetricLeftRate", v)} testId="slider-asym-left" />
              <SliderRow label="R RATE" value={params.asymmetricRightRate} display={`${params.asymmetricRightRate.toFixed(1)} Hz`}
                min={0.5} max={15} step={0.1} onChange={(v) => updateParam("asymmetricRightRate", v)} testId="slider-asym-right" />
            </Section>
          )}

          {showClustered && (
            <Section label="CLUSTERED">
              <SliderRow label="BURSTS" value={params.clusterBurstCount} display={`${params.clusterBurstCount}`}
                min={2} max={8} step={1} onChange={(v) => updateParam("clusterBurstCount", v)} testId="slider-burst-count" />
              <SliderRow label="RATE" value={params.clusterBurstRate} display={`${params.clusterBurstRate.toFixed(0)} Hz`}
                min={5} max={20} step={0.5} onChange={(v) => updateParam("clusterBurstRate", v)} testId="slider-burst-rate" />
              <SliderRow label="PAUSE" value={params.clusterPauseDuration} display={`${params.clusterPauseDuration.toFixed(1)}s`}
                min={0.1} max={2} step={0.1} onChange={(v) => updateParam("clusterPauseDuration", v)} testId="slider-cluster-pause" />
            </Section>
          )}

          {showRandomized && (
            <Section label="RANDOMIZED">
              <SliderRow label="MIN" value={params.randomMinInterval} display={`${params.randomMinInterval.toFixed(1)}s`}
                min={0.1} max={1} step={0.05}
                onChange={(v) => {
                  const clamped = Math.min(v, params.randomMaxInterval);
                  updateParam("randomMinInterval", clamped);
                }}
                testId="slider-rand-min" />
              <SliderRow label="MAX" value={params.randomMaxInterval} display={`${params.randomMaxInterval.toFixed(1)}s`}
                min={0.1} max={2} step={0.05}
                onChange={(v) => {
                  const clamped = Math.max(v, params.randomMinInterval);
                  updateParam("randomMaxInterval", clamped);
                }}
                testId="slider-rand-max" />
            </Section>
          )}

          {/* User Audio Upload */}
          <Section label="MIX AUDIO">
            <div
              onDrop={handleAudioDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOverAudio(true); }}
              onDragLeave={() => setIsDragOverAudio(false)}
              className="flex flex-col gap-2"
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: `2px dashed ${isDragOverAudio ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.1)"}`,
                background: isDragOverAudio ? "rgba(34,211,238,0.05)" : "transparent",
                transition: "all 150ms",
              }}
            >
              <button
                data-testid="button-upload-audio"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingAudio}
                className="w-full flex items-center gap-2 px-2 py-2 rounded text-xs transition-all"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: isLoadingAudio ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.45)",
                  cursor: isLoadingAudio ? "not-allowed" : "pointer",
                  opacity: isLoadingAudio ? 0.6 : 1,
                }}
              >
                {isLoadingAudio ? (
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                ) : (
                  <Upload size={11} />
                )}
                <span className="truncate">
                  {isLoadingAudio ? "Loading..." : (userFileName ? userFileName : "Upload WAV / MP3")}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,.mp3,audio/*"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-audio-file"
                disabled={isLoadingAudio}
              />
            </div>
            {userFileName && !audioError && (
              <div className="text-xs mt-1" style={{ color: "hsl(192,87%,53%)", fontSize: 11, opacity: 0.7 }}>
                Loaded · mixed into output
              </div>
            )}
            {audioError && (
              <div className="text-xs mt-1" style={{ color: "#ef4444", fontSize: 9 }}>
                ✕ {audioError}
              </div>
            )}
          </Section>

          {/* Export Settings */}
          <Section label="EXPORT SETTINGS">
            <div className="mb-2">
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.1em" }}>BIT DEPTH</div>
              <div className="flex gap-2">
                {([16, 24] as const).map((bd) => (
                  <button
                    key={bd}
                    data-testid={`bit-depth-${bd}`}
                    onClick={() => updateExportParam("bitDepth", bd)}
                    className="flex-1 py-1.5 rounded text-xs transition-all"
                    style={{
                      background: exportParams.bitDepth === bd ? "rgba(34,211,238,0.1)" : "transparent",
                      border: `1px solid ${exportParams.bitDepth === bd ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: exportParams.bitDepth === bd ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.4)",
                      fontSize: 10,
                    }}
                  >
                    {bd}-bit
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.1em" }}>DURATION</div>
              <div className="flex flex-wrap gap-1">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    data-testid={`duration-${opt.value}`}
                    onClick={() => updateExportParam("durationSeconds", opt.value)}
                    className="px-2 py-1 rounded text-xs transition-all"
                    style={{
                      background: exportParams.durationSeconds === opt.value ? "rgba(34,211,238,0.1)" : "transparent",
                      border: `1px solid ${exportParams.durationSeconds === opt.value ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: exportParams.durationSeconds === opt.value ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.38)",
                      fontSize: 10,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        </aside>
      </div>

      {/* Footer — Safety + Education */}
      <footer
        className="shrink-0"
        style={{ background: "#0e1016", borderTop: "1px solid rgba(255,255,255,0.05)" }}
        data-testid="footer"
      >
        <div className="flex gap-0">
          <CollapsiblePanel
            label="Safety Notice"
            isOpen={showSafety}
            onToggle={() => setShowSafety(!showSafety)}
            testId="panel-safety"
          >
            <div className="flex flex-col gap-3">
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                This tool produces bilateral auditory stimulation. Use at comfortable volume levels only.
                Discontinue use if you experience discomfort, dizziness, or headaches. Not recommended
                for individuals with epilepsy or seizure disorders. Consult a healthcare professional
                before use if you have any medical conditions. This tool is for educational and
                experimental purposes and is not medical equipment.
              </p>
              <div
                className="text-xs leading-relaxed"
                style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}
              >
                <div style={{ color: "rgba(34,211,238,0.55)", letterSpacing: "0.06em", marginBottom: 4 }}>
                  SAMPLE ATTRIBUTIONS
                </div>
                <p>
                  Bundled sound samples are sourced from{" "}
                  <a
                    href="https://freesound.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "rgba(34,211,238,0.7)", textDecoration: "underline" }}
                  >
                    Freesound.org
                  </a>{" "}
                  under Creative Commons licenses. Authors: zesoundresearchinc, lezaarth, waveplaysfx,
                  angelkunev, fmaudio, birdofthenorth, ajanhallinta, redswan_studios, moodyfingers, cvltiv8r.
                </p>
              </div>
            </div>
          </CollapsiblePanel>

          <div style={{ width: 1, background: "rgba(255,255,255,0.05)" }} />

          <CollapsiblePanel
            label="About Isochronic Tones"
            isOpen={showEducation}
            onToggle={() => setShowEducation(!showEducation)}
            testId="panel-education"
          >
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "rgba(34,211,238,0.7)", letterSpacing: "0.06em" }}>
                  Isochronic Tones vs Binaural Beats
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Isochronic tones are evenly-spaced pulses of sound that can influence brainwave activity.
                  Unlike binaural beats (which require two different frequencies played simultaneously),
                  isochronic tones use discrete amplitude-modulated pulses and work without headphones.
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "rgba(34,211,238,0.7)", letterSpacing: "0.06em" }}>
                  Bilateral Stimulation
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Alternating sound between left and right ears is a technique used in EMDR therapy.
                  This alternating pattern may help facilitate interhemispheric communication and
                  processing. Headphones are recommended for proper bilateral separation.
                </p>
              </div>
            </div>
          </CollapsiblePanel>
        </div>
      </footer>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: "0.15em" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, letterSpacing: "0.1em" }}>
          {label}
        </span>
        <span className="text-xs font-semibold" style={{ color: "rgba(34,211,238,0.75)", fontSize: 10 }}>
          {display}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        data-testid={testId}
      />
    </div>
  );
}

function SamplePicker({
  label,
  selectedUrl,
  onSelect,
  onPreview,
}: {
  label: string;
  selectedUrl: string | null;
  onSelect: (path: string) => void;
  onPreview: (path: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const categories = Array.from(new Set(BUNDLED_SAMPLES.map(s => s.category)));

  const handlePreviewClick = async (path: string) => {
    if (playingPath === path) {
      audioEngine.stopPreview();
      setPlayingPath(null);
      return;
    }
    setLoadingPath(path);
    try {
      await onPreview(path);
      setPlayingPath(path);
    } catch {
      // ignore preview failures
    } finally {
      setLoadingPath(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-left px-2 py-1.5 rounded text-xs transition-all"
        style={{
          background: expanded ? "rgba(34,211,238,0.1)" : "transparent",
          border: `1px solid ${expanded ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)"}`,
          color: expanded ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.65)",
          fontSize: 11,
        }}
      >
        {selectedUrl ? BUNDLED_SAMPLES.find(s => s.path === selectedUrl)?.label || "Selected" : label}
      </button>
      {expanded && (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat} className="flex flex-col gap-0.5">
              <div className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, textTransform: "uppercase" }}>
                {cat}
              </div>
              {BUNDLED_SAMPLES.filter(s => s.category === cat).map((sample) => (
                <div key={sample.slug} className="flex gap-1">
                  <button
                    onClick={() => {
                      onSelect(sample.path);
                      setExpanded(false);
                    }}
                    className="flex-1 text-left px-1.5 py-1 rounded text-xs transition-all"
                    style={{
                      background: selectedUrl === sample.path ? "rgba(34,211,238,0.12)" : "transparent",
                      border: `1px solid ${selectedUrl === sample.path ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.05)"}`,
                      color: selectedUrl === sample.path ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.5)",
                      fontSize: 11,
                    }}
                  >
                    {sample.label}
                  </button>
                  <button
                    onClick={() => handlePreviewClick(sample.path)}
                    disabled={loadingPath !== null && loadingPath !== sample.path}
                    className="px-1.5 py-1 rounded text-xs"
                    style={{
                      background: playingPath === sample.path ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${playingPath === sample.path ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: playingPath === sample.path ? "hsl(192,87%,53%)" : "rgba(255,255,255,0.4)",
                      fontSize: 10,
                      minWidth: 22,
                      cursor: loadingPath !== null && loadingPath !== sample.path ? "not-allowed" : "pointer",
                    }}
                    title={playingPath === sample.path ? "Stop preview" : "Preview sample"}
                  >
                    {loadingPath === sample.path ? (
                      <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                    ) : playingPath === sample.path ? "■" : "▶"}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsiblePanel({
  label,
  isOpen,
  onToggle,
  children,
  testId,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  testId: string;
}) {
  return (
    <div className="flex-1" data-testid={testId}>
      <button
        onClick={onToggle}
        data-testid={`${testId}-toggle`}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left"
        style={{ borderBottom: isOpen ? "1px solid rgba(255,255,255,0.05)" : "none" }}
      >
        <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", fontSize: 10 }}>
          {label}
        </span>
        {isOpen ? (
          <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.25)" }} />
        ) : (
          <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.25)" }} />
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}
