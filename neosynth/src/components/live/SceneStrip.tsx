import { useLiveMode } from "@/lib/stores/liveMode";

const ACCENT = "hsl(192,87%,53%)";

export function SceneStrip() {
  const { scene, updateScene, sceneArmed, sceneCurrentSlot, snapshots } = useLiveMode();

  const setSlot = (slotIdx: 0 | 1 | 2 | 3, snapshotIdx: number | null) => {
    const next = [...scene.slots] as typeof scene.slots;
    next[slotIdx] = snapshotIdx;
    updateScene({ slots: next });
  };

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 11, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
          SCENE
        </span>
        <span style={{ fontSize: 10, color: sceneArmed ? ACCENT : "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
          {sceneArmed ? "ARMED" : "IDLE"}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>BARS</span>
          <input
            type="number"
            min={1} max={64}
            value={scene.barsPerSlot}
            onChange={(e) => updateScene({ barsPerSlot: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{
              width: 44, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2,
              color: "rgba(255,255,255,0.7)", fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              padding: "2px 4px", outline: "none",
            }}
          />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>MORPH</span>
          <input
            type="number"
            min={0} max={32}
            value={scene.morphBars}
            onChange={(e) => updateScene({ morphBars: Math.max(0, Math.min(scene.barsPerSlot, parseInt(e.target.value) || 0)) })}
            style={{
              width: 44, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2,
              color: "rgba(255,255,255,0.7)", fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              padding: "2px 4px", outline: "none",
            }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {scene.slots.map((snapIdx, i) => {
          const isActive = sceneArmed && sceneCurrentSlot === i;
          const label = snapIdx === null ? "—" : (snapshots[snapIdx]?.label ?? `Snap ${snapIdx + 1}`);
          return (
            <div
              key={i}
              style={{
                flex: 1, padding: "6px 4px",
                borderRadius: 3,
                background: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? ACCENT : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <div style={{
                fontSize: 9, color: isActive ? ACCENT : "rgba(255,255,255,0.3)",
                fontFamily: "'JetBrains Mono', monospace", marginBottom: 2,
              }}>
                SLOT {i + 1}
              </div>
              <select
                value={snapIdx ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSlot(i as 0 | 1 | 2 | 3, v === "" ? null : parseInt(v));
                }}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 2,
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: "2px 4px",
                  outline: "none",
                }}
                title={label}
              >
                <option value="">— empty</option>
                {snapshots.map((s, si) => (
                  <option key={si} value={si} disabled={!s}>
                    {s ? `${si + 1}: ${s.label}` : `${si + 1}: (empty)`}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
