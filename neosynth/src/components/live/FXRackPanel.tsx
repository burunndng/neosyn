import { useLiveMode } from "@/lib/stores/liveMode";
import { Knob } from "./Knob";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import type { ClockDivision } from "@/lib/audio/MasterClock";

const ACCENT = "hsl(192,87%,53%)";

export function FXRackPanel() {
  const { fx, updateFx, bpm } = useLiveMode();

  return (
    <div className="flex gap-3">
      {/* HPF */}
      <div className="flex flex-col gap-1.5 p-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 100 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 8, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>HPF</span>
          <button
            onClick={() => updateFx({ hpfEnabled: !fx.hpfEnabled })}
            style={{
              width: 16, height: 16, borderRadius: 2,
              background: fx.hpfEnabled ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${fx.hpfEnabled ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: fx.hpfEnabled ? ACCENT : "rgba(255,255,255,0.3)",
              fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {fx.hpfEnabled ? "ON" : "OF"}
          </button>
        </div>
        <Knob
          value={fx.hpfFreq}
          min={20}
          max={2000}
          size={44}
          valueLabel={`${fx.hpfFreq.toFixed(0)}Hz`}
          onChange={(v) => updateFx({ hpfFreq: v })}
        />
      </div>

      {/* LPF */}
      <div className="flex flex-col gap-1.5 p-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 100 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 8, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>LPF</span>
          <button
            onClick={() => updateFx({ lpfEnabled: !fx.lpfEnabled })}
            style={{
              width: 16, height: 16, borderRadius: 2,
              background: fx.lpfEnabled ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${fx.lpfEnabled ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: fx.lpfEnabled ? ACCENT : "rgba(255,255,255,0.3)",
              fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {fx.lpfEnabled ? "ON" : "OF"}
          </button>
        </div>
        <Knob
          value={fx.lpfFreq}
          min={200}
          max={20000}
          size={44}
          valueLabel={`${fx.lpfFreq.toFixed(0)}Hz`}
          onChange={(v) => updateFx({ lpfFreq: v })}
        />
      </div>

      {/* Delay */}
      <div className="flex flex-col gap-1.5 p-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 120 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 8, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>DELAY</span>
          <button
            onClick={() => updateFx({ delayEnabled: !fx.delayEnabled })}
            style={{
              width: 16, height: 16, borderRadius: 2,
              background: fx.delayEnabled ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${fx.delayEnabled ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: fx.delayEnabled ? ACCENT : "rgba(255,255,255,0.3)",
              fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {fx.delayEnabled ? "ON" : "OF"}
          </button>
        </div>
        <div className="flex justify-around">
          <Knob
            value={fx.delayTime}
            min={0.01}
            max={1.9}
            size={40}
            label="TIME"
            valueLabel={`${fx.delayTime.toFixed(2)}s`}
            onChange={(v) => updateFx({ delayTime: v })}
          />
          <Knob
            value={fx.delayFeedback}
            min={0}
            max={0.95}
            size={40}
            label="FB"
            valueLabel={fx.delayFeedback.toFixed(2)}
            onChange={(v) => updateFx({ delayFeedback: v })}
          />
          <Knob
            value={fx.delayWet}
            min={0}
            max={1}
            size={40}
            label="WET"
            valueLabel={fx.delayWet.toFixed(2)}
            onChange={(v) => updateFx({ delayWet: v })}
          />
        </div>
        {/* Sync division */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => updateFx({ delaySync: null })}
            style={{
              padding: "1px 3px", borderRadius: 2, fontSize: 7,
              background: fx.delaySync === null ? "rgba(34,211,238,0.12)" : "transparent",
              border: `1px solid ${fx.delaySync === null ? ACCENT : "rgba(255,255,255,0.07)"}`,
              color: fx.delaySync === null ? ACCENT : "rgba(255,255,255,0.3)",
              cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            FREE
          </button>
          {CLOCK_DIVISIONS.slice(0, 4).map((d) => (
            <button
              key={d}
              onClick={() => updateFx({ delaySync: d as ClockDivision })}
              style={{
                padding: "1px 3px", borderRadius: 2, fontSize: 7,
                background: fx.delaySync === d ? "rgba(34,211,238,0.12)" : "transparent",
                border: `1px solid ${fx.delaySync === d ? ACCENT : "rgba(255,255,255,0.07)"}`,
                color: fx.delaySync === d ? ACCENT : "rgba(255,255,255,0.3)",
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Reverb */}
      <div className="flex flex-col gap-1.5 p-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 100 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 8, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>REVERB</span>
          <button
            onClick={() => updateFx({ reverbEnabled: !fx.reverbEnabled })}
            style={{
              width: 16, height: 16, borderRadius: 2,
              background: fx.reverbEnabled ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${fx.reverbEnabled ? ACCENT : "rgba(255,255,255,0.1)"}`,
              color: fx.reverbEnabled ? ACCENT : "rgba(255,255,255,0.3)",
              fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {fx.reverbEnabled ? "ON" : "OF"}
          </button>
        </div>
        <Knob
          value={fx.reverbWet}
          min={0}
          max={1}
          size={44}
          label="WET"
          valueLabel={fx.reverbWet.toFixed(2)}
          onChange={(v) => updateFx({ reverbWet: v })}
        />
      </div>
    </div>
  );
}
