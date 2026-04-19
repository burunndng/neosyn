import { useEffect, useRef } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { Knob } from "./Knob";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import type { LFOState } from "@/lib/audio/ModulationSources";
import type { ClockDivision } from "@/lib/audio/MasterClock";

const ACCENT = "hsl(192,87%,53%)";
const SHAPES = ["sine", "triangle", "saw", "square", "s&h"] as const;

function LFOShapeIcon({ shape }: { shape: string }) {
  const paths: Record<string, string> = {
    sine:     "M1,8 Q4,1 7,8 Q10,15 13,8 Q16,1 19,8",
    triangle: "M1,14 L5,2 L10,14 L15,2 L19,14",
    saw:      "M1,14 L10,2 L10,14 L19,2",
    square:   "M1,14 L1,2 L10,2 L10,14 L19,14 L19,2",
    "s&h":    "M1,14 L5,14 L5,6 L9,6 L9,10 L13,10 L13,3 L17,3 L17,14",
  };
  return (
    <svg width={20} height={16} viewBox="0 0 20 16" fill="none">
      <path d={paths[shape] ?? paths.sine} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface LFOUnitProps {
  state: LFOState;
  phaseFn: () => number;
  update: (patch: Partial<LFOState>) => void;
  label: string;
}

function LFOUnit({ state, phaseFn, update, label }: LFOUnitProps) {
  const phaseMeterRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      const phase = phaseFn();
      if (phaseMeterRef.current) {
        const r = 7;
        const angle = phase * 2 * Math.PI;
        phaseMeterRef.current.setAttribute("cx", String(10 + r * Math.sin(angle)));
        phaseMeterRef.current.setAttribute("cy", String(10 - r * Math.cos(angle)));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phaseFn]);

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 160 }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <svg width={20} height={20} style={{ opacity: 0.8 }}>
            <circle cx={10} cy={10} r={7} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
            <circle ref={phaseMeterRef} cx={10} cy={3} r={2} fill={ACCENT} />
          </svg>
          <button
            onClick={() => update({ enabled: !state.enabled })}
            style={{
              width: 20, height: 20, borderRadius: 4,
              background: state.enabled ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${state.enabled ? ACCENT : "rgba(255,255,255,0.12)"}`,
              color: state.enabled ? ACCENT : "rgba(255,255,255,0.3)",
              fontSize: 8, cursor: "pointer",
            }}
            title="Enable/disable"
          >
            {state.enabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Shape selector */}
      <div className="flex gap-1">
        {SHAPES.map((s) => (
          <button
            key={s}
            onClick={() => update({ shape: s })}
            style={{
              flex: 1, padding: "3px 0", borderRadius: 3,
              background: state.shape === s ? "rgba(34,211,238,0.12)" : "transparent",
              border: `1px solid ${state.shape === s ? ACCENT : "rgba(255,255,255,0.07)"}`,
              color: state.shape === s ? ACCENT : "rgba(255,255,255,0.3)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title={s}
          >
            <LFOShapeIcon shape={s} />
          </button>
        ))}
      </div>

      {/* Rate + depth knobs */}
      <div className="flex justify-around">
        <div className="flex flex-col items-center gap-1">
          {state.syncDiv === null ? (
            <Knob
              value={state.rateHz} min={0.01} max={20}
              size={44} label="RATE"
              valueLabel={`${state.rateHz.toFixed(2)}Hz`}
              onChange={(v) => update({ rateHz: v })}
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(34,211,238,0.08)", border: `1px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, color: ACCENT, fontFamily: "'JetBrains Mono', monospace" }}>{state.syncDiv}</span>
              </div>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>RATE</span>
            </div>
          )}
        </div>
        <Knob
          value={state.depth} min={0} max={1}
          size={44} label="DEPTH"
          valueLabel={state.depth.toFixed(2)}
          onChange={(v) => update({ depth: v })}
        />
      </div>

      {/* Sync division */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => update({ syncDiv: null })}
          style={{
            padding: "2px 5px", borderRadius: 3, fontSize: 8,
            background: state.syncDiv === null ? "rgba(34,211,238,0.12)" : "transparent",
            border: `1px solid ${state.syncDiv === null ? ACCENT : "rgba(255,255,255,0.07)"}`,
            color: state.syncDiv === null ? ACCENT : "rgba(255,255,255,0.3)",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          FREE
        </button>
        {CLOCK_DIVISIONS.map((d) => (
          <button
            key={d}
            onClick={() => update({ syncDiv: d as ClockDivision })}
            style={{
              padding: "2px 5px", borderRadius: 3, fontSize: 8,
              background: state.syncDiv === d ? "rgba(34,211,238,0.12)" : "transparent",
              border: `1px solid ${state.syncDiv === d ? ACCENT : "rgba(255,255,255,0.07)"}`,
              color: state.syncDiv === d ? ACCENT : "rgba(255,255,255,0.3)",
              cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Bipolar toggle */}
      <button
        onClick={() => update({ bipolar: !state.bipolar })}
        style={{
          padding: "2px 0", borderRadius: 3, fontSize: 8, width: "100%",
          background: state.bipolar ? "rgba(34,211,238,0.08)" : "transparent",
          border: `1px solid ${state.bipolar ? ACCENT : "rgba(255,255,255,0.07)"}`,
          color: state.bipolar ? ACCENT : "rgba(255,255,255,0.3)",
          cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em",
        }}
      >
        {state.bipolar ? "BIPOLAR  ±" : "UNIPOLAR 0→1"}
      </button>
    </div>
  );
}

export function LFOPanel() {
  const { lfo1, updateLfo1, lfo2, updateLfo2, getLfo1Phase, getLfo2Phase } = useLiveMode();

  return (
    <div className="flex gap-3">
      <LFOUnit
        state={lfo1}
        phaseFn={getLfo1Phase}
        update={updateLfo1}
        label="LFO 1"
      />
      <LFOUnit
        state={lfo2}
        phaseFn={getLfo2Phase}
        update={updateLfo2}
        label="LFO 2"
      />
    </div>
  );
}
