import { useLiveMode } from "@/lib/stores/liveMode";
import { BUNDLED_SAMPLES } from "@/lib/stores/params";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import type { ClockDivision } from "@/lib/audio/MasterClock";
import type { DeckState } from "@/lib/audio/SampleDeck";
import { Knob } from "./Knob";
import { Volume2, VolumeX, Headphones, Power } from "lucide-react";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.5)";
const DECK_KEYS = ["Z", "X", "C", "V"];
const DECK_TINTS = [
  "168,85,247",   // violet
  "236,72,153",   // pink
  "34,197,94",    // green
  "250,204,21",   // amber
];

function MiniBtn({
  active, onClick, children, title, color, flex,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  color?: string;
  flex?: boolean;
}) {
  const tint = color ?? "34,211,238";
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: flex ? 1 : undefined,
        padding: "2px 5px",
        borderRadius: 2,
        fontSize: 8,
        background: active ? `rgba(${tint},0.18)` : "transparent",
        border: `1px solid ${active ? `rgb(${tint})` : "rgba(255,255,255,0.07)"}`,
        color: active ? `rgb(${tint})` : DIM,
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </button>
  );
}

function DivisionRow({
  value, onChange, color,
}: {
  value: ClockDivision;
  onChange: (v: ClockDivision) => void;
  color: string;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {CLOCK_DIVISIONS.map((d) => (
        <MiniBtn key={d} active={value === d} onClick={() => onChange(d)} color={color}>
          {d}
        </MiniBtn>
      ))}
    </div>
  );
}

function DeckCard({ idx, deck }: { idx: number; deck: DeckState }) {
  const { updateDeck, toggleDeckMute, toggleDeckSolo } = useLiveMode();
  const tint = DECK_TINTS[idx];
  const tintRgb = `rgb(${tint})`;
  const tintFill = (alpha: number) => `rgba(${tint},${alpha})`;

  const setSlug = (slug: string | null) => updateDeck(idx, { sampleSlug: slug });

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded"
      style={{
        background: deck.active ? tintFill(0.04) : "rgba(255,255,255,0.02)",
        border: `1px solid ${deck.active ? tintFill(0.32) : "rgba(255,255,255,0.06)"}`,
        opacity: deck.active ? 1 : 0.55,
        flex: 1,
        minWidth: 220,
      }}
    >
      {/* Header: deck label + key + power */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{
            fontSize: 9, color: tintRgb,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, letterSpacing: "0.12em",
          }}>
            DECK {idx + 1}
          </span>
          <span style={{
            fontSize: 8, padding: "1px 4px", borderRadius: 2,
            background: "rgba(255,255,255,0.06)", color: DIM,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.06em",
          }}>
            {DECK_KEYS[idx]}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => updateDeck(idx, { active: !deck.active })}
            title={deck.active ? "Disable deck (no triggers)" : "Enable deck"}
            style={{
              padding: "2px 4px", borderRadius: 2,
              background: deck.active ? tintFill(0.18) : "rgba(255,255,255,0.04)",
              border: `1px solid ${deck.active ? tintRgb : "rgba(255,255,255,0.08)"}`,
              color: deck.active ? tintRgb : DIM,
              cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            <Power size={10} />
          </button>
          <button
            onClick={() => toggleDeckMute(idx)}
            title="Mute deck (key Z/X/C/V)"
            style={{
              padding: "2px 4px", borderRadius: 2,
              background: deck.mute ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${deck.mute ? "#ef4444" : "rgba(255,255,255,0.08)"}`,
              color: deck.mute ? "#ef4444" : DIM,
              cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            {deck.mute ? <VolumeX size={10} /> : <Volume2 size={10} />}
          </button>
          <button
            onClick={() => toggleDeckSolo(idx)}
            title="Solo deck (Shift+Z/X/C/V)"
            style={{
              padding: "2px 4px", borderRadius: 2,
              background: deck.solo ? "rgba(250,204,21,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${deck.solo ? "#facc15" : "rgba(255,255,255,0.08)"}`,
              color: deck.solo ? "#facc15" : DIM,
              cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            <Headphones size={10} />
          </button>
        </div>
      </div>

      {/* Sample picker */}
      <select
        value={deck.sampleSlug ?? ""}
        onChange={(e) => setSlug(e.target.value || null)}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${tintFill(0.18)}`,
          color: tintRgb,
          padding: "3px 6px",
          borderRadius: 3,
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          width: "100%",
        }}
      >
        <option value="">— none —</option>
        {BUNDLED_SAMPLES.map((s) => (
          <option key={s.slug} value={s.slug}>
            [{s.category}] {s.label}
          </option>
        ))}
      </select>

      {/* Division */}
      <DivisionRow
        value={deck.division}
        onChange={(d) => updateDeck(idx, { division: d })}
        color={tint}
      />

      {/* Knob row 1: gain / pan / pitch / probability */}
      <div className="flex justify-between gap-1">
        <Knob
          value={deck.gain} min={0} max={1.5} defaultValue={0.8}
          size={40} label="GAIN" valueLabel={deck.gain.toFixed(2)}
          color={tintRgb}
          paramKey={`deck.${idx}.gain`}
          onChange={(v) => updateDeck(idx, { gain: v })}
        />
        <Knob
          value={deck.pan} min={-1} max={1} defaultValue={0}
          size={40} label="PAN"
          valueLabel={deck.pan === 0 ? "C" : deck.pan < 0 ? `L${Math.round(-deck.pan * 100)}` : `R${Math.round(deck.pan * 100)}`}
          color={tintRgb}
          paramKey={`deck.${idx}.pan`}
          onChange={(v) => updateDeck(idx, { pan: v })}
        />
        <Knob
          value={deck.pitch} min={-24} max={24} defaultValue={0}
          size={40} label="PITCH" valueLabel={`${deck.pitch > 0 ? "+" : ""}${deck.pitch.toFixed(0)}st`}
          color={tintRgb}
          paramKey={`deck.${idx}.pitch`}
          onChange={(v) => updateDeck(idx, { pitch: Math.round(v) })}
        />
        <Knob
          value={deck.probability} min={0} max={1} defaultValue={1}
          size={40} label="PROB" valueLabel={`${Math.round(deck.probability * 100)}%`}
          color={tintRgb}
          paramKey={`deck.${idx}.probability`}
          onChange={(v) => updateDeck(idx, { probability: v })}
        />
      </div>

      {/* Knob row 2: HPF / LPF / drive / swing */}
      <div className="flex justify-between gap-1">
        <Knob
          value={deck.hpfFreq} min={20} max={8000} defaultValue={20}
          size={40} label="HPF" valueLabel={deck.hpfFreq < 100 ? `${deck.hpfFreq.toFixed(0)}` : `${(deck.hpfFreq / 1000).toFixed(1)}k`}
          color={tintRgb}
          paramKey={`deck.${idx}.hpf`}
          onChange={(v) => updateDeck(idx, { hpfFreq: v })}
        />
        <Knob
          value={deck.lpfFreq} min={200} max={20000} defaultValue={20000}
          size={40} label="LPF" valueLabel={deck.lpfFreq < 1000 ? `${deck.lpfFreq.toFixed(0)}` : `${(deck.lpfFreq / 1000).toFixed(1)}k`}
          color={tintRgb}
          paramKey={`deck.${idx}.lpf`}
          onChange={(v) => updateDeck(idx, { lpfFreq: v })}
        />
        <Knob
          value={deck.drive} min={0} max={1} defaultValue={0}
          size={40} label="DRIVE" valueLabel={deck.drive.toFixed(2)}
          color={tintRgb}
          paramKey={`deck.${idx}.drive`}
          onChange={(v) => updateDeck(idx, { drive: v })}
        />
        <Knob
          value={deck.swing} min={0} max={0.5} defaultValue={0}
          size={40} label="SWING" valueLabel={`${Math.round(deck.swing * 100)}%`}
          color={tintRgb}
          paramKey={`deck.${idx}.swing`}
          onChange={(v) => updateDeck(idx, { swing: v })}
        />
      </div>

      {/* Knob row 3: sends + reverse */}
      <div className="flex items-center justify-between gap-1">
        <Knob
          value={deck.delaySend} min={0} max={1} defaultValue={0}
          size={40} label="DLY ➜" valueLabel={`${Math.round(deck.delaySend * 100)}%`}
          color={tintRgb}
          paramKey={`deck.${idx}.delaySend`}
          onChange={(v) => updateDeck(idx, { delaySend: v })}
        />
        <Knob
          value={deck.reverbSend} min={0} max={1} defaultValue={0}
          size={40} label="REV ➜" valueLabel={`${Math.round(deck.reverbSend * 100)}%`}
          color={tintRgb}
          paramKey={`deck.${idx}.reverbSend`}
          onChange={(v) => updateDeck(idx, { reverbSend: v })}
        />
        <button
          onClick={() => updateDeck(idx, { reverse: !deck.reverse })}
          title="Reverse playback"
          style={{
            padding: "4px 8px",
            borderRadius: 3,
            background: deck.reverse ? tintFill(0.18) : "rgba(255,255,255,0.04)",
            border: `1px solid ${deck.reverse ? tintRgb : "rgba(255,255,255,0.08)"}`,
            color: deck.reverse ? tintRgb : DIM,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            letterSpacing: "0.08em",
            cursor: "pointer",
            alignSelf: "center",
            height: 28,
          }}
        >
          REV
        </button>
      </div>
    </div>
  );
}

export function SampleDecksPanel() {
  const { decks, resetDecks } = useLiveMode();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span style={{
          fontSize: 9, color: ACCENT,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600, letterSpacing: "0.12em",
        }}>
          SAMPLE DECKS · 4 voices · per-deck FX + sends to master
        </span>
        <div className="flex items-center gap-2">
          <span style={{
            fontSize: 8, color: "rgba(255,255,255,0.3)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Z X C V mute · Shift solo
          </span>
          <button
            onClick={resetDecks}
            title="Restore default deck setup"
            style={{
              padding: "2px 8px",
              borderRadius: 2,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: DIM,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            RESET
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {decks.map((d, i) => (
          <DeckCard key={i} idx={i} deck={d} />
        ))}
      </div>
    </div>
  );
}
