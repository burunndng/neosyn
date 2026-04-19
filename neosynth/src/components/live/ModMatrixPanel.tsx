import { useLiveMode } from "@/lib/stores/liveMode";
import type { ModSourceId, ModDestId, ModRouting } from "@/lib/stores/liveMode";
import { Trash2 } from "lucide-react";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.5)";

const SOURCES: { id: ModSourceId; label: string }[] = [
  { id: "lfo1", label: "LFO 1" },
  { id: "lfo2", label: "LFO 2" },
  { id: "seq", label: "Sequencer" },
  { id: "env", label: "Env Follower" },
  { id: "macro1", label: "Macro 1" },
  { id: "macro2", label: "Macro 2" },
  { id: "macro3", label: "Macro 3" },
  { id: "macro4", label: "Macro 4" },
];

const DESTINATIONS: { id: ModDestId; label: string; category: string }[] = [
  // Scheduler params
  { id: "rate", label: "Rate", category: "Bilateral" },
  { id: "dutyCycle", label: "Duty Cycle", category: "Bilateral" },
  { id: "attack", label: "Attack", category: "Envelope" },
  { id: "decay", label: "Decay", category: "Envelope" },
  // Carrier freqs
  { id: "carrierFrequency", label: "Carrier A Freq", category: "Carrier" },
  { id: "layerBCarrierFrequency", label: "Carrier B Freq", category: "Carrier" },
  // Gains
  { id: "layerAGain", label: "Layer A Gain", category: "Mix" },
  { id: "layerBGain", label: "Layer B Gain", category: "Mix" },
  { id: "leftGain", label: "Left Gain", category: "Mix" },
  { id: "rightGain", label: "Right Gain", category: "Mix" },
  // FX
  { id: "hpfFreq", label: "HPF Freq", category: "FX" },
  { id: "lpfFreq", label: "LPF Freq", category: "FX" },
  { id: "delayTime", label: "Delay Time", category: "FX" },
  { id: "delayFeedback", label: "Delay FB", category: "FX" },
  { id: "delayWet", label: "Delay Wet", category: "FX" },
  { id: "reverbWet", label: "Reverb Wet", category: "FX" },
  // Macros
  { id: "macro1", label: "→ Macro 1", category: "Macro" },
  { id: "macro2", label: "→ Macro 2", category: "Macro" },
  { id: "macro3", label: "→ Macro 3", category: "Macro" },
  { id: "macro4", label: "→ Macro 4", category: "Macro" },
];

export function ModMatrixPanel() {
  const { modRoutings, addRouting, updateRouting, removeRouting, clearAllRoutings } = useLiveMode();

  const canAdd = modRoutings.length < 8;

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded overflow-y-auto"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        minHeight: 180,
        maxHeight: 400,
      }}
    >
      <div className="flex items-center justify-between sticky top-0 bg-black/40 p-0.5 -mx-1 -mt-1 -mb-0.5 px-2">
        <span style={{ fontSize: 10, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
          MOD MATRIX ({modRoutings.length}/8)
        </span>
        <div className="flex gap-1">
          {modRoutings.length > 0 && (
            <button
              onClick={clearAllRoutings}
              title="Clear all routings"
              style={{
                padding: "1px 5px",
                borderRadius: 2,
                fontSize: 9,
                background: "rgba(255,0,0,0.1)",
                border: "1px solid rgba(255,0,0,0.3)",
                color: "#ff6b6b",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            >
              ✕ CLEAR
            </button>
          )}
          {canAdd && (
            <button
              onClick={() =>
                addRouting({
                  sourceId: "lfo1",
                  destId: "rate",
                  depth: 0.5,
                  bypass: false,
                })
              }
              style={{
                padding: "1px 6px",
                borderRadius: 2,
                fontSize: 9,
                background: "rgba(34,211,238,0.12)",
                border: `1px solid ${ACCENT}`,
                color: ACCENT,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            >
              + ADD
            </button>
          )}
        </div>
      </div>

      {/* Routing rows */}
      <div className="flex flex-col gap-1">
        {modRoutings.length === 0 && (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "8px" }}>
            No routings. Click + ADD to create one.
          </div>
        )}
        {modRoutings.map((r) => (
          <RoutingRow key={r.id} routing={r} onUpdate={updateRouting} onRemove={removeRouting} />
        ))}
      </div>
    </div>
  );
}

function RoutingRow({
  routing,
  onUpdate,
  onRemove,
}: {
  routing: ModRouting;
  onUpdate: (id: string, patch: Partial<ModRouting>) => void;
  onRemove: (id: string) => void;
}) {
  const srcLabel = SOURCES.find((s) => s.id === routing.sourceId)?.label || routing.sourceId;
  const destLabel = DESTINATIONS.find((d) => d.id === routing.destId)?.label || routing.destId;

  return (
    <div
      className="flex items-center gap-2 p-1.5 rounded"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Source dropdown */}
      <select
        value={routing.sourceId}
        onChange={(e) => onUpdate(routing.id, { sourceId: e.target.value as ModSourceId })}
        style={{
          flex: 1,
          padding: "2px 4px",
          borderRadius: 2,
          fontSize: 8,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)",
          fontFamily: "'JetBrains Mono', monospace",
          cursor: "pointer",
        }}
      >
        {SOURCES.map((s) => (
          <option key={s.id} value={s.id} style={{ background: "#1a1a1a", color: "#fff" }}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Depth slider */}
      <div className="flex items-center gap-1" style={{ minWidth: 80 }}>
        <input
          type="range"
          min={-1} max={1} step={0.01}
          value={routing.depth}
          onChange={(e) => onUpdate(routing.id, { depth: parseFloat(e.target.value) })}
          style={{ flex: 1, accentColor: ACCENT, height: 4 }}
        />
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", minWidth: 20 }}>
          {routing.depth.toFixed(2)}
        </span>
      </div>

      {/* Destination dropdown */}
      <select
        value={routing.destId}
        onChange={(e) => onUpdate(routing.id, { destId: e.target.value as ModDestId })}
        style={{
          flex: 1,
          padding: "2px 4px",
          borderRadius: 2,
          fontSize: 8,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)",
          fontFamily: "'JetBrains Mono', monospace",
          cursor: "pointer",
        }}
      >
        {DESTINATIONS.map((d) => (
          <option key={d.id} value={d.id} style={{ background: "#1a1a1a", color: "#fff" }}>
            [{d.category}] {d.label}
          </option>
        ))}
      </select>

      {/* Bypass toggle */}
      <button
        onClick={() => onUpdate(routing.id, { bypass: !routing.bypass })}
        style={{
          width: 20,
          height: 20,
          borderRadius: 2,
          background: routing.bypass ? "rgba(255,255,255,0.06)" : "rgba(34,211,238,0.12)",
          border: `1px solid ${routing.bypass ? "rgba(255,255,255,0.1)" : ACCENT}`,
          color: routing.bypass ? "rgba(255,255,255,0.3)" : ACCENT,
          fontSize: 8,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
        }}
        title="Bypass this routing"
      >
        {routing.bypass ? "⊘" : "✓"}
      </button>

      {/* Delete button */}
      <button
        onClick={() => onRemove(routing.id)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 2,
          background: "transparent",
          border: "1px solid rgba(255,0,0,0.2)",
          color: "rgba(255,100,100,0.6)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
        title="Remove routing"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}
