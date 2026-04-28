import { useState } from "react";
import { ChevronDown, Play, Square, Circle, StopCircle } from "lucide-react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { useSynthParams } from "@/lib/stores/params";
import { LFOPanel } from "./LFOPanel";
import { SequencerPanel } from "./SequencerPanel";
import { ModMatrixPanel } from "./ModMatrixPanel";
import { MacroKnobs } from "./MacroKnobs";
import { FXRackPanel } from "./FXRackPanel";
import { LayerRhythmPanel } from "./LayerRhythmPanel";
import { SnapshotBank } from "./SnapshotBank";
import { SceneStrip } from "./SceneStrip";
import { PerformancePads } from "./PerformancePads";
import { OutputMeter } from "./OutputMeter";
import { SampleDecksPanel } from "./SampleDecksPanel";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.5)";

export function DJModeLayout() {
  const {
    bpm, setBpm, tapTempo,
    isPlaying, setIsPlaying,
    isRecording, startRecording, stopRecording,
    sceneArmed, setSceneArmed,
    morphMode, setMorphMode,
    morphTime, setMorphTime,
  } = useLiveMode();
  const { masterVolume, setMasterVolume } = useSynthParams();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleBpmInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) setBpm(v);
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ gap: 0 }}>
      {/* ─ DJ TRANSPORT BAR ─ */}
      <div
        className="flex items-center gap-4 px-4 py-3 shrink-0"
        style={{
          background: "#0e1016",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        {/* Play/Stop, Record, Scene Arm */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            className="flex items-center justify-center rounded"
            style={{
              width: 48,
              height: 48,
              background: isPlaying ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${isPlaying ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: isPlaying ? ACCENT : DIM,
            }}
            title="Play / Stop (Space)"
          >
            {isPlaying ? <Square size={20} /> : <Play size={20} />}
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className="flex items-center justify-center rounded"
            style={{
              width: 48,
              height: 48,
              background: isRecording ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${isRecording ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
              color: isRecording ? "#ef4444" : DIM,
            }}
            title="Record session"
          >
            {isRecording ? <StopCircle size={20} /> : <Circle size={20} />}
          </button>

          <button
            onClick={() => setSceneArmed(!sceneArmed)}
            className="flex items-center justify-center rounded px-3"
            style={{
              height: 48,
              background: sceneArmed ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${sceneArmed ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: sceneArmed ? ACCENT : DIM,
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.12em",
              fontWeight: 600,
            }}
            title="Arm auto-arrange scene"
          >
            SCENE
          </button>
        </div>

        {/* BPM input + Tap */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>BPM</span>
            <input
              type="number"
              min={20}
              max={300}
              step={1}
              value={bpm}
              onChange={handleBpmInput}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: ACCENT,
                fontSize: 32,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                width: 80,
                letterSpacing: "-0.02em",
              }}
            />
          </div>

          <button
            onClick={tapTempo}
            className="px-4 py-2.5 rounded text-xs font-semibold tracking-wider uppercase"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: DIM,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.12em",
              height: 48,
              display: "flex",
              alignItems: "center",
            }}
            title="Tap Tempo (T)"
          >
            TAP
          </button>
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-2 ml-auto">
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>VOL</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            style={{ width: 100, accentColor: ACCENT }}
            title="Master Volume"
          />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", minWidth: 28 }}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>

        {isRecording && (
          <div className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} className="animate-pulse" />
            <span style={{ fontSize: 10, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>REC</span>
          </div>
        )}
      </div>

      {/* ─ DJ MAIN CONTENT ─ */}
      <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        {/* Sample Decks — main live performance surface */}
        <div>
          <SampleDecksPanel />
        </div>

        {/* Performance Pads */}
        <div>
          <PerformancePads />
        </div>

        {/* Snapshots */}
        <div>
          <SnapshotBank />
        </div>

        {/* Morph Controls */}
        <div
          className="flex items-center gap-3 p-3 rounded"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <button
            onClick={() => setMorphMode(!morphMode)}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              background: morphMode ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${morphMode ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: morphMode ? ACCENT : DIM,
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.08em",
            }}
            title="Toggle Morph mode (M)"
          >
            {morphMode ? "MORPH: ON" : "MORPH: OFF"}
          </button>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Time (sec):</span>
            <input
              type="number"
              min={0}
              max={16}
              step={0.5}
              value={morphTime}
              onChange={(e) => setMorphTime(parseFloat(e.target.value))}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: ACCENT,
                padding: "4px 8px",
                borderRadius: 3,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                width: 60,
              }}
            />
          </div>
        </div>

        {/* Scene auto-arrange */}
        <div>
          <SceneStrip />
        </div>

        {/* Output Meter */}
        <div>
          <OutputMeter />
        </div>

        {/* ─ ADVANCED SECTION (collapsed by default) ─ */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-3 rounded"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            color: ACCENT,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.08em",
            width: "100%",
            marginTop: 8,
          }}
          title="Show/hide advanced synthesis controls"
        >
          {showAdvanced ? "▼ ADVANCED" : "▶ ADVANCED"}
          <ChevronDown size={14} style={{ transform: showAdvanced ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4" style={{ animation: "fadeIn 0.15s ease-in" }}>
            {/* Mod sources */}
            <div className="flex gap-4 live-row-modulation">
              <LFOPanel />
              <SequencerPanel />
              <LayerRhythmPanel />
            </div>

            {/* Mod matrix + Macros */}
            <div className="flex gap-4">
              <div className="flex-1">
                <ModMatrixPanel />
              </div>
              <div className="flex flex-col gap-3 items-stretch" style={{ minWidth: 360 }}>
                <div className="flex flex-col gap-2 items-center p-2 rounded" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.12em" }}>MACROS</span>
                  <MacroKnobs />
                </div>
              </div>
            </div>

            {/* FX Rack */}
            <div>
              <FXRackPanel />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
