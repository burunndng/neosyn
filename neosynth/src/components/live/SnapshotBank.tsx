import { useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { useSynthParams } from "@/lib/stores/params";
import { Save, Download } from "lucide-react";

const ACCENT = "hsl(192,87%,53%)";

export function SnapshotBank() {
  const { snapshots, saveSnapshot, recallSnapshot, morphTime, setMorphTime, morphMode, setMorphMode, activeSnapshot } = useLiveMode();
  const { params } = useSynthParams();
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const openEditDialog = (slot: number) => {
    setEditSlot(slot);
    setEditLabel(snapshots[slot]?.label || `Snapshot ${slot + 1}`);
  };

  const saveAndClose = () => {
    if (editSlot !== null) {
      saveSnapshot(editSlot, editLabel, params);
      setEditSlot(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Morph controls */}
      <div
        className="flex items-center gap-3 p-2 rounded"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>MORPH</span>
        <button
          onClick={() => setMorphMode(!morphMode)}
          style={{
            padding: "2px 8px", borderRadius: 3, fontSize: 8,
            background: morphMode ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${morphMode ? ACCENT : "rgba(255,255,255,0.1)"}`,
            color: morphMode ? ACCENT : "rgba(255,255,255,0.3)",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {morphMode ? "ON" : "OFF"}
        </button>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="range"
            min={0} max={10} step={0.1}
            value={morphTime}
            onChange={(e) => setMorphTime(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: ACCENT }}
            disabled={!morphMode}
          />
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", minWidth: 30 }}>
            {morphTime.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Snapshot slots */}
      <div className="flex gap-2">
        {snapshots.map((snap, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (snap) {
                recallSnapshot(idx, morphMode ? morphTime : 0);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openEditDialog(idx);
            }}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 3,
              background:
                activeSnapshot === idx
                  ? "rgba(34,211,238,0.15)"
                  : snap
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.03)",
              border: `1px solid ${activeSnapshot === idx ? ACCENT : snap ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`,
              color: activeSnapshot === idx ? ACCENT : snap ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
              cursor: "pointer",
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: snap ? 600 : 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              textAlign: "center",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
            title={snap ? `Click to load\nRight-click to edit` : "Right-click to save"}
          >
            <span style={{ fontSize: 10, fontWeight: 700 }}>{idx + 1}</span>
            {snap ? (
              <span style={{ fontSize: 7, marginTop: 2, opacity: 0.8 }}>{snap.label.slice(0, 12)}</span>
            ) : (
              <span style={{ fontSize: 7, marginTop: 2, opacity: 0.5 }}>empty</span>
            )}
          </button>
        ))}
      </div>

      {/* Edit dialog */}
      {editSlot !== null && (
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
          onClick={() => setEditSlot(null)}
        >
          <div
            style={{
              background: "#0e1016",
              border: `1px solid ${ACCENT}`,
              borderRadius: 6,
              padding: 20,
              minWidth: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: ACCENT, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              Save Snapshot {editSlot + 1}
            </h3>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 3,
                border: `1px solid ${ACCENT}`,
                background: "rgba(34,211,238,0.05)",
                color: ACCENT,
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: 16,
                fontSize: 12,
              }}
              placeholder="Snapshot name..."
            />
            <div className="flex gap-2">
              <button
                onClick={saveAndClose}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  borderRadius: 3,
                  background: ACCENT,
                  color: "#000",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                SAVE
              </button>
              <button
                onClick={() => setEditSlot(null)}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
