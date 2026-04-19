import { useCallback } from "react";
import { Play, Square, Circle, StopCircle } from "lucide-react";
import { useLiveMode } from "@/lib/stores/liveMode";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.5)";

export function ClockPanel() {
  const {
    bpm, setBpm, tapTempo,
    isPlaying, setIsPlaying,
    isRecording, startRecording, stopRecording,
  } = useLiveMode();

  const handlePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  const handleBpmInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) setBpm(v);
  }, [setBpm]);

  return (
    <div
      className="flex items-center gap-6 px-5 py-3 shrink-0"
      style={{
        background: "#0e1016",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        height: 64,
      }}
    >
      {/* Transport */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlay}
          className="flex items-center justify-center rounded"
          style={{
            width: 40, height: 40,
            background: isPlaying ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isPlaying ? ACCENT : "rgba(255,255,255,0.1)"}`,
            color: isPlaying ? ACCENT : DIM,
          }}
          title="Play / Stop (Space)"
        >
          {isPlaying ? <Square size={16} /> : <Play size={16} />}
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="flex items-center justify-center rounded"
          style={{
            width: 40, height: 40,
            background: isRecording ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isRecording ? "#ef4444" : "rgba(255,255,255,0.1)"}`,
            color: isRecording ? "#ef4444" : DIM,
          }}
          title="Record session"
        >
          {isRecording ? <StopCircle size={16} /> : <Circle size={16} />}
        </button>
      </div>

      <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

      {/* BPM display + tap */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>BPM</span>
          <input
            type="number"
            min={20} max={300} step={1}
            value={bpm}
            onChange={handleBpmInput}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: ACCENT,
              fontSize: 28,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              width: 72,
              letterSpacing: "-0.02em",
            }}
          />
        </div>

        <button
          onClick={tapTempo}
          className="px-3 py-1.5 rounded text-xs font-semibold tracking-wider uppercase"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: DIM,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
          title="Tap Tempo (T)"
        >
          TAP
        </button>

        <div className="flex flex-col items-center">
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Hz</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace" }}>
            {(bpm / 60).toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />

      {/* BPM slider */}
      <div className="flex items-center gap-2 flex-1 max-w-48">
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>20</span>
        <input
          type="range"
          min={20} max={300} step={1}
          value={bpm}
          onChange={handleBpmInput}
          style={{ flex: 1, accentColor: ACCENT }}
        />
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>300</span>
      </div>

      {isRecording && (
        <div className="flex items-center gap-1.5 ml-auto">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} className="animate-pulse" />
          <span style={{ fontSize: 10, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>REC</span>
        </div>
      )}
    </div>
  );
}
