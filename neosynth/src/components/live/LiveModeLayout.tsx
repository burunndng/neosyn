import { useEffect, useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { ClockPanel } from "./ClockPanel";
import { LFOPanel } from "./LFOPanel";
import { SequencerPanel } from "./SequencerPanel";
import { ModMatrixPanel } from "./ModMatrixPanel";
import { MacroKnobs } from "./MacroKnobs";
import { FXRackPanel } from "./FXRackPanel";
import { SnapshotBank } from "./SnapshotBank";
import { HelpCircle } from "lucide-react";

const ACCENT = "hsl(192,87%,53%)";

export function LiveModeLayout() {
  const { tapTempo, setIsPlaying, isPlaying, snapshots, recallSnapshot, morphTime, morphMode } = useLiveMode();
  const [showHelp, setShowHelp] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in text inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key !== " ") return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case "t":
        case "T":
          e.preventDefault();
          tapTempo();
          break;
        case "m":
        case "M":
          // Morph toggle handled by UI
          break;
        case "?":
          e.preventDefault();
          setShowHelp(!showHelp);
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
          e.preventDefault();
          const slotNum = parseInt(e.key) - 1;
          if (snapshots[slotNum]) {
            recallSnapshot(slotNum, morphMode ? morphTime : 0);
          }
          break;
        case "[":
        case "]":
          // Previous/next snapshot — not implemented yet
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying, tapTempo, snapshots, recallSnapshot, morphMode, morphTime, showHelp]);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        background: "#06070b",
        fontFamily: "'JetBrains Mono', monospace",
        color: "rgba(255,255,255,0.8)",
      }}
    >
      {/* Top: Clock + Transport */}
      <ClockPanel />

      {/* Middle: Mod sources + Mod matrix + Knobs + FX */}
      <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
        {/* Mod sources */}
        <div className="flex gap-4">
          <LFOPanel />
          <SequencerPanel />
        </div>

        {/* Mod matrix + Macros + FX side-by-side */}
        <div className="flex gap-4">
          <div className="flex-1">
            <ModMatrixPanel />
          </div>
          <div className="flex flex-col gap-3 items-center">
            <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>MACROS</span>
            <MacroKnobs />
          </div>
        </div>

        {/* FX Rack */}
        <div>
          <FXRackPanel />
        </div>

        {/* Snapshots */}
        <SnapshotBank />
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{
              background: "#0e1016",
              border: `1px solid ${ACCENT}`,
              borderRadius: 6,
              padding: 20,
              maxWidth: 500,
              maxHeight: "80vh",
              overflow: "y-auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: ACCENT, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>KEYBOARD SHORTCUTS</h2>
            <div className="flex flex-col gap-2" style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ fontWeight: 600, minWidth: 60 }}>Space</div>
                <div>Play / Stop</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ fontWeight: 600, minWidth: 60 }}>T</div>
                <div>Tap Tempo</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ fontWeight: 600, minWidth: 60 }}>1–8</div>
                <div>Recall Snapshot 1–8</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ fontWeight: 600, minWidth: 60 }}>?</div>
                <div>Toggle this help</div>
              </div>
              <hr style={{ opacity: 0.2, margin: "12px 0" }} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                <p>Right-click snapshot slots to save.</p>
                <p>Drag knobs up/down to adjust values.</p>
                <p>Modulation matrix runs at 50 Hz control rate.</p>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: 20,
                width: "100%",
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
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Help button (bottom-right) */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(34,211,238,0.12)",
          border: `1px solid ${ACCENT}`,
          color: ACCENT,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}
        title="Help (? key)"
      >
        <HelpCircle size={18} />
      </button>
    </div>
  );
}
