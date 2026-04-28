import { useEffect, useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { ClockPanel } from "./ClockPanel";
import { ProModeLayout } from "./ProModeLayout";
import { DJModeLayout } from "./DJModeLayout";
import { HelpCircle, Music4 } from "lucide-react";
import { HelpOverlay } from "./HelpOverlay";
import { MidiLearnPanel } from "./MidiLearnPanel";

const ACCENT = "hsl(192,87%,53%)";

export function LiveModeLayout() {
  const {
    tapTempo, setIsPlaying, isPlaying, snapshots, recallSnapshot,
    morphTime, morphMode, setMorphMode, uiMode, setUiMode,
    toggleDeckMute, toggleDeckSolo,
    midiOpen, setMidiOpen, midiLearnEnabled,
  } = useLiveMode();
  const [showHelp, setShowHelp] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts while typing in any editable field.
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target && target.isContentEditable)
      ) {
        return;
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
          e.preventDefault();
          setMorphMode(!morphMode);
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
        case "z":
        case "Z":
        case "x":
        case "X":
        case "c":
        case "C":
        case "v":
        case "V": {
          e.preventDefault();
          const idx = ({ z: 0, x: 1, c: 2, v: 3 } as Record<string, number>)[e.key.toLowerCase()];
          if (idx === undefined) break;
          if (e.shiftKey) toggleDeckSolo(idx);
          else toggleDeckMute(idx);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying, tapTempo, snapshots, recallSnapshot, morphMode, setMorphMode, morphTime, showHelp, toggleDeckMute, toggleDeckSolo]);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        background: "#06070b",
        fontFamily: "'JetBrains Mono', monospace",
        color: "rgba(255,255,255,0.8)",
      }}
    >
      {/* Top: Clock + Transport (Pro mode) or DJ Transport (DJ mode) */}
      {uiMode === 'pro' && <ClockPanel />}

      {/* Mode selector + Help button header (only in DJ mode) */}
      {uiMode === 'dj' && (
        <div
          className="flex items-center gap-3 px-4 py-2 shrink-0"
          style={{
            background: "#0e1016",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
            NEOSYNTH
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUiMode('pro')}
              style={{
                padding: "4px 12px",
                borderRadius: 3,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "0.08em",
              }}
              title="Toggle UI mode"
            >
              DJ / PRO
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 3,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: ACCENT,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Help (? key)"
            >
              ?
            </button>
          </div>
        </div>
      )}

      {/* Content area: conditional based on UI mode */}
      {uiMode === 'pro' ? (
        <ProModeLayout />
      ) : (
        <DJModeLayout />
      )}

      {/* Help overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {/* MIDI Learn overlay */}
      {midiOpen && <MidiLearnPanel onClose={() => setMidiOpen(false)} />}

      {/* Floating bottom-right action buttons */}
      <div
        style={{
          position: "fixed", bottom: 20, right: 20,
          display: "flex", flexDirection: "column", gap: 10,
          zIndex: 100,
        }}
      >
        {/* MIDI button */}
        <button
          onClick={() => setMidiOpen(!midiOpen)}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: midiLearnEnabled ? "rgba(250,204,21,0.18)" : "rgba(34,211,238,0.12)",
            border: `1px solid ${midiLearnEnabled ? "#facc15" : ACCENT}`,
            color: midiLearnEnabled ? "#facc15" : ACCENT,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: midiLearnEnabled ? "0 0 12px rgba(250,204,21,0.4)" : "none",
            transition: "all 0.15s",
          }}
          title={midiLearnEnabled ? "MIDI Learn (active)" : "MIDI Learn"}
        >
          <Music4 size={18} />
        </button>

        {/* Help button */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(34,211,238,0.12)",
            border: `1px solid ${ACCENT}`,
            color: ACCENT, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="Help (? key)"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </div>
  );
}
