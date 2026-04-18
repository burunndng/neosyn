import { useLiveMode } from "@/lib/stores/liveMode";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import type { ClockDivision } from "@/lib/audio/MasterClock";

const ACCENT = "hsl(192,87%,53%)";

export function SequencerPanel() {
  const { seq, updateSeq, seqStep } = useLiveMode();

  const toggleGate = (i: number) => {
    const gates = [...seq.gates];
    gates[i] = !gates[i];
    updateSeq({ gates });
  };

  const setStepValue = (i: number, v: number) => {
    const steps = [...seq.steps];
    steps[i] = v;
    updateSeq({ steps });
  };

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
          SEQUENCER
        </span>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>DIV</span>
          <div className="flex gap-1">
            {CLOCK_DIVISIONS.map((d) => (
              <button
                key={d}
                onClick={() => updateSeq({ syncDiv: d as ClockDivision })}
                style={{
                  padding: "2px 5px", borderRadius: 3, fontSize: 8,
                  background: seq.syncDiv === d ? "rgba(34,211,238,0.12)" : "transparent",
                  border: `1px solid ${seq.syncDiv === d ? ACCENT : "rgba(255,255,255,0.07)"}`,
                  color: seq.syncDiv === d ? ACCENT : "rgba(255,255,255,0.3)",
                  cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={() => updateSeq({ running: !seq.running })}
            style={{
              padding: "2px 8px", borderRadius: 3, fontSize: 8,
              background: seq.running ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${seq.running ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: seq.running ? ACCENT : "rgba(255,255,255,0.3)",
              cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em",
            }}
          >
            {seq.running ? "RUN" : "STOP"}
          </button>
        </div>
      </div>

      {/* Step value bars + gate buttons */}
      <div className="flex gap-1">
        {seq.steps.map((stepVal, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
            {/* Value bar — drag to set */}
            <div
              style={{
                width: "100%", height: 48, position: "relative",
                background: "rgba(255,255,255,0.05)", borderRadius: 3,
                cursor: "ns-resize",
                border: i === seqStep ? `1px solid ${ACCENT}` : "1px solid transparent",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startV = stepVal;
                const onMove = (ev: MouseEvent) => {
                  const dy = (startY - ev.clientY) / 48;
                  setStepValue(i, Math.max(0, Math.min(1, startV + dy)));
                };
                const onUp = () => {
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            >
              <div
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: `${stepVal * 100}%`,
                  background: i === seqStep
                    ? ACCENT
                    : seq.gates[i]
                      ? "rgba(34,211,238,0.4)"
                      : "rgba(255,255,255,0.1)",
                  borderRadius: "0 0 2px 2px",
                  transition: "height 0.05s",
                }}
              />
            </div>
            {/* Gate toggle */}
            <button
              onClick={() => toggleGate(i)}
              style={{
                width: "100%", height: 10, borderRadius: 2,
                background: seq.gates[i] ? (i === seqStep ? ACCENT : "rgba(34,211,238,0.3)") : "rgba(255,255,255,0.06)",
                border: "none", cursor: "pointer",
              }}
            />
          </div>
        ))}
      </div>

      {/* Step numbers */}
      <div className="flex gap-1">
        {seq.steps.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, textAlign: "center",
              fontSize: 7, fontFamily: "'JetBrains Mono', monospace",
              color: i === seqStep ? ACCENT : "rgba(255,255,255,0.15)",
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
