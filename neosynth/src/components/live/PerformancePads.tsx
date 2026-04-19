import { useEffect, useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import type { PadId } from "@/lib/audio/FXRack";
import { Zap, Scissors, Waves, Repeat, ArrowUp, ArrowDown, CircleDot, Shuffle } from "lucide-react";

const ACCENT = "hsl(192,87%,53%)";

interface PadConfig {
  id: PadId;
  label: string;
  sub: string;
  icon: typeof Zap;
  key: string;
  color: string;
}

const PADS: PadConfig[] = [
  { id: "impact",      label: "IMPACT",  sub: "accent",    icon: Zap,        key: "q", color: "34,211,238" },
  { id: "drop",        label: "DROP",    sub: "1 beat cut", icon: ArrowDown, key: "w", color: "239,68,68"  },
  { id: "sweepUp",     label: "SWEEP",   sub: "LPF riser", icon: ArrowUp,   key: "e", color: "250,204,21" },
  { id: "stutter",     label: "STUTTER", sub: "1/16 gate", icon: Shuffle,    key: "r", color: "168,85,247" },
  { id: "killLow",     label: "KILL LO", sub: "HPF 800",   icon: CircleDot,  key: "a", color: "59,130,246" },
  { id: "killHigh",    label: "KILL HI", sub: "LPF 800",   icon: Scissors,   key: "s", color: "236,72,153" },
  { id: "delayThrow",  label: "D-THROW", sub: "FB 0.9",   icon: Repeat,      key: "d", color: "34,197,94"  },
  { id: "reverbThrow", label: "R-THROW", sub: "wet slam",  icon: Waves,      key: "f", color: "14,165,233" },
];

export function PerformancePads() {
  const { triggerPad, isPlaying } = useLiveMode();
  const [flash, setFlash] = useState<PadId | null>(null);

  const fire = (pad: PadId) => {
    triggerPad(pad);
    setFlash(pad);
    setTimeout(() => setFlash((cur) => (cur === pad ? null : cur)), 180);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;
      const pad = PADS.find((p) => p.key === e.key.toLowerCase());
      if (pad) {
        e.preventDefault();
        fire(pad.id);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.12em" }}>
          PERFORMANCE PADS
        </span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
          {isPlaying ? "Q W E R · A S D F" : "start playback to arm"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PADS.map((pad) => {
          const isFlash = flash === pad.id;
          const Icon = pad.icon;
          const armed = isPlaying;
          return (
            <button
              key={pad.id}
              onMouseDown={() => armed && fire(pad.id)}
              disabled={!armed}
              style={{
                padding: "10px 8px",
                borderRadius: 4,
                background: isFlash
                  ? `rgba(${pad.color},0.35)`
                  : armed
                    ? `rgba(${pad.color},0.08)`
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${isFlash ? `rgb(${pad.color})` : armed ? `rgba(${pad.color},0.4)` : "rgba(255,255,255,0.06)"}`,
                color: isFlash ? "#fff" : armed ? `rgb(${pad.color})` : "rgba(255,255,255,0.25)",
                cursor: armed ? "pointer" : "not-allowed",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                fontFamily: "'JetBrains Mono', monospace",
                transition: "background 0.08s, border-color 0.08s, box-shadow 0.08s",
                boxShadow: isFlash ? `0 0 18px rgba(${pad.color},0.5)` : "none",
                minHeight: 64,
                userSelect: "none",
              }}
              title={`${pad.label} — key: ${pad.key.toUpperCase()}`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon size={12} />
                <span
                  style={{
                    fontSize: 8,
                    padding: "1px 4px",
                    borderRadius: 2,
                    background: isFlash ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.06)",
                    color: isFlash ? "#fff" : "rgba(255,255,255,0.5)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {pad.key.toUpperCase()}
                </span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
                {pad.label}
              </span>
              <span style={{ fontSize: 8, opacity: 0.75, letterSpacing: "0.04em" }}>
                {pad.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
