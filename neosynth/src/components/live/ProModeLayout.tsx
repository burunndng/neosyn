import { HelpCircle } from "lucide-react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { ClockPanel } from "./ClockPanel";
import { LFOPanel } from "./LFOPanel";
import { SequencerPanel } from "./SequencerPanel";
import { ModMatrixPanel } from "./ModMatrixPanel";
import { MacroKnobs } from "./MacroKnobs";
import { FXRackPanel } from "./FXRackPanel";
import { LayerRhythmPanel } from "./LayerRhythmPanel";
import { SnapshotBank } from "./SnapshotBank";
import { SceneStrip } from "./SceneStrip";
import { PerformancePads } from "./PerformancePads";
import { OutputMeter } from "./OutputMeter";

const ACCENT = "hsl(192,87%,53%)";

export function ProModeLayout({
  showHelp,
  setShowHelp,
}: {
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
      {/* Mod sources */}
      <div className="flex gap-4 live-row-modulation">
        <LFOPanel />
        <SequencerPanel />
        <LayerRhythmPanel />
      </div>

      {/* Mod matrix + Macros + Meter side-by-side */}
      <div className="flex gap-4">
        <div className="flex-1">
          <ModMatrixPanel />
        </div>
        <div className="flex flex-col gap-3 items-stretch" style={{ minWidth: 360 }}>
          <div className="flex flex-col gap-2 items-center p-2 rounded" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.12em" }}>MACROS</span>
            <MacroKnobs />
          </div>
          <OutputMeter />
        </div>
      </div>

      {/* FX Rack */}
      <div>
        <FXRackPanel />
      </div>

      {/* Performance Pads */}
      <PerformancePads />

      {/* Snapshots */}
      <SnapshotBank />

      {/* Scene auto-arrange */}
      <SceneStrip />
    </div>
  );
}
