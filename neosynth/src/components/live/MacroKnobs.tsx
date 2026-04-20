import { useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { useSynthParams, type SynthParams } from "@/lib/stores/params";
import { Knob } from "./Knob";

const ACCENT = "hsl(192,87%,53%)";

// Target params that can be assigned to macros
const ASSIGNABLE_PARAMS: Array<{ key: keyof SynthParams; label: string }> = [
  { key: "rate", label: "Rate (Hz)" },
  { key: "dutyCycle", label: "Duty Cycle" },
  { key: "attack", label: "Attack" },
  { key: "decay", label: "Decay" },
  { key: "carrierFrequency", label: "Carrier Freq A" },
  { key: "layerBCarrierFrequency", label: "Carrier Freq B" },
  { key: "layerAGain", label: "Layer A Gain" },
  { key: "layerBGain", label: "Layer B Gain" },
  { key: "leftGain", label: "Left Gain" },
  { key: "rightGain", label: "Right Gain" },
];

export function MacroKnobs() {
  const { macros, setMacroValue, updateMacro } = useLiveMode();
  const { params } = useSynthParams();
  const [editMacroIdx, setEditMacroIdx] = useState<number | null>(null);
  const [editAssignIdx, setEditAssignIdx] = useState<number | null>(null);
  const [newTargetKey, setNewTargetKey] = useState<keyof SynthParams>("rate");
  const [newMinVal, setNewMinVal] = useState<number>(0);
  const [newMaxVal, setNewMaxVal] = useState<number>(1);

  const openEditDialog = (idx: number) => {
    setEditMacroIdx(idx);
    setEditAssignIdx(null);
    setNewTargetKey("rate");
    setNewMinVal(0);
    setNewMaxVal(1);
  };

  const saveAssignment = () => {
    if (editMacroIdx === null) return;
    const m = macros[editMacroIdx];
    const newAssignment = { paramKey: String(newTargetKey), minVal: newMinVal, maxVal: newMaxVal };
    const updated = editAssignIdx !== null
      ? m.assignments.map((a, i) => i === editAssignIdx ? newAssignment : a)
      : [...m.assignments, newAssignment];
    updateMacro(editMacroIdx, { assignments: updated as any });
    setEditMacroIdx(null);
  };

  const removeAssignment = (macroIdx: number, assignIdx: number) => {
    const updated = macros[macroIdx].assignments.filter((_, i) => i !== assignIdx);
    updateMacro(macroIdx, { assignments: updated as any });
  };

  return (
    <>
      <div className="flex gap-4">
        {macros.map((m, idx) => (
          <div key={m.id} className="flex flex-col items-center gap-2">
            <input
              type="text"
              value={m.label}
              onChange={(e) => updateMacro(idx, { label: e.target.value })}
              style={{
                width: 64,
                background: "transparent",
                border: "none",
                outline: "none",
                color: ACCENT,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                textAlign: "center",
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.1em",
                padding: "0 2px",
              }}
              placeholder={m.label}
            />
            <div className="flex gap-2 items-end">
              <Knob
                value={m.value}
                min={0}
                max={1}
                size={64}
                valueLabel={m.value.toFixed(2)}
                onChange={(v) => setMacroValue(idx, v)}
              />
              <button
                onClick={() => openEditDialog(idx)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${m.assignments.length > 0 ? ACCENT : "rgba(255,255,255,0.1)"}`,
                  color: m.assignments.length > 0 ? ACCENT : "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title={`Assign target param (${m.assignments.length} active)`}
              >
                ⋯
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Assignment edit dialog */}
      {editMacroIdx !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditMacroIdx(null)}
        >
          <div
            style={{
              background: "#0e1016",
              border: `1px solid ${ACCENT}`,
              borderRadius: 6,
              padding: 20,
              minWidth: 400,
              maxHeight: "80vh",
              overflow: "y-auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: ACCENT, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Assign {macros[editMacroIdx].label}
            </h3>

            {/* List existing assignments */}
            {macros[editMacroIdx].assignments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 6 }}>
                  Active Assignments
                </div>
                {macros[editMacroIdx].assignments.map((asgn, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.03)",
                      marginBottom: 4,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <div>
                      {ASSIGNABLE_PARAMS.find(p => p.key === asgn.paramKey)?.label || asgn.paramKey}
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                        {asgn.minVal.toFixed(2)} → {asgn.maxVal.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => removeAssignment(editMacroIdx, idx)}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 2,
                        background: "rgba(255,0,0,0.1)",
                        border: "1px solid rgba(255,0,0,0.3)",
                        color: "#ff6b6b",
                        fontSize: 10,
                        cursor: "pointer",
                      }}
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 }}>
                Add New Assignment
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                  Target Parameter
                </label>
                <select
                  value={newTargetKey}
                  onChange={(e) => setNewTargetKey(e.target.value as keyof SynthParams)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 3,
                    border: `1px solid ${ACCENT}`,
                    background: "rgba(34,211,238,0.05)",
                    color: ACCENT,
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {ASSIGNABLE_PARAMS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                    Min Value
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={newMinVal}
                    onChange={(e) => setNewMinVal(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 3,
                      border: `1px solid ${ACCENT}`,
                      background: "rgba(34,211,238,0.05)",
                      color: ACCENT,
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                    Max Value
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={newMaxVal}
                    onChange={(e) => setNewMaxVal(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 3,
                      border: `1px solid ${ACCENT}`,
                      background: "rgba(34,211,238,0.05)",
                      color: ACCENT,
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={saveAssignment}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    borderRadius: 3,
                    background: ACCENT,
                    color: "#000",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  ADD
                </button>
                <button
                  onClick={() => setEditMacroIdx(null)}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 10,
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
