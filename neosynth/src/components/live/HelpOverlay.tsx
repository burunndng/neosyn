const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.5)";
const SECTION = "rgba(255,255,255,0.12)";

interface Row {
  key: string;
  desc: string;
}

interface Section {
  title: string;
  rows: Row[];
  notes?: string[];
}

const SECTIONS: Section[] = [
  {
    title: "TRANSPORT",
    rows: [
      { key: "Space",    desc: "Play / Stop" },
      { key: "T",        desc: "Tap Tempo — tap repeatedly to set BPM" },
    ],
    notes: ["BPM range: 20–300. BPM is saved across sessions."],
  },
  {
    title: "SAMPLE DECKS  (4 simultaneous voices)",
    rows: [
      { key: "Z",         desc: "Toggle mute — Deck 1" },
      { key: "X",         desc: "Toggle mute — Deck 2" },
      { key: "C",         desc: "Toggle mute — Deck 3" },
      { key: "V",         desc: "Toggle mute — Deck 4" },
      { key: "Shift+Z",   desc: "Toggle solo — Deck 1 (silences all other decks)" },
      { key: "Shift+X",   desc: "Toggle solo — Deck 2" },
      { key: "Shift+C",   desc: "Toggle solo — Deck 3" },
      { key: "Shift+V",   desc: "Toggle solo — Deck 4" },
    ],
    notes: [
      "Each deck independently picks a sample and a clock division (1/1 → 1/16T).",
      "Per-deck controls: GAIN · PAN · PITCH (semitones) · PROB (probability 0–100%) · HPF · LPF · DRIVE (tanh saturation) · SWING · DLY➜ (send to master delay) · REV➜ (send to master reverb).",
      "REV button reverses sample playback.",
      "Power icon enables/disables the deck's trigger (no CPU used when inactive).",
      "Deck state + all knobs persist across sessions (localStorage).",
    ],
  },
  {
    title: "PERFORMANCE PADS",
    rows: [
      { key: "Q",  desc: "IMPACT — momentary 1.6× gain transient boost" },
      { key: "W",  desc: "DROP — 1-beat silence then immediate resume" },
      { key: "E",  desc: "SWEEP UP — LPF sweeps from 300 Hz → 18 kHz over 4 beats" },
      { key: "R",  desc: "STUTTER — 1/16 gate chop for 4 beats" },
      { key: "A",  desc: "KILL LO — HPF snap to 800 Hz, ramp back over 2 beats" },
      { key: "S",  desc: "KILL HI — LPF snap to 800 Hz, ramp back over 2 beats" },
      { key: "D",  desc: "D-THROW — delay feedback slam to 0.9, wet to 0.9, ramps back" },
      { key: "F",  desc: "R-THROW — reverb wet slam to 1.0, ramps back over 2 beats" },
    ],
    notes: [
      "Pads only fire when transport is PLAYING.",
      "Click pads with mouse or use keyboard. All 8 keys fire one-shot even while held.",
    ],
  },
  {
    title: "SNAPSHOTS",
    rows: [
      { key: "1 – 8",  desc: "Recall snapshot in that slot (instant, or morphed if MORPH: ON)" },
      { key: "M",      desc: "Toggle Morph mode — subsequent recalls linearly interpolate params" },
    ],
    notes: [
      "Right-click any snapshot slot to SAVE the current patch into it.",
      "Snapshots store: all synth params, BPM, LFO 1+2, step sequencer, FX rack, 4 macros.",
      "Deck state is NOT stored in snapshots (decks persist independently).",
      "MORPH TIME sets how many seconds the linear interpolation lasts (0 = instant).",
    ],
  },
  {
    title: "SCENE AUTO-ARRANGE",
    rows: [
      { key: "SCENE btn", desc: "Arm / disarm auto-advance through 4 snapshot slots" },
    ],
    notes: [
      "ARM SCENE → engine cycles through slots 0-1-2-3 every N bars.",
      "BARS/SLOT sets how many bars to hold each slot before advancing.",
      "MORPH BARS: crossfade begins this many bars before the slot boundary.",
      "Assign snapshot indices to each of the 4 scene slots (leave empty to freeze).",
    ],
  },
  {
    title: "MASTER FX RACK",
    rows: [
      { key: "DRIVE",      desc: "Tanh waveshaper saturation — adds harmonic warmth/distortion" },
      { key: "HPF",        desc: "Highpass filter 20–2000 Hz — cuts low-end rumble" },
      { key: "LPF",        desc: "Lowpass filter 200–20000 Hz — dark/bright filter" },
      { key: "CRUSH",      desc: "Bit-crusher 1–12 bits — lo-fi grit (12 = clean)" },
      { key: "WIDTH",      desc: "Mid/Side stereo width 0 (mono) → 1 (normal) → 2 (ultra-wide)" },
      { key: "GATE",       desc: "Trance gate: rhythmic on/off chop, clock-synced, depth 0–1" },
      { key: "PUMP",       desc: "Sidechain pump envelope — duck depth + clock division" },
      { key: "DELAY",      desc: "Stereo delay: time (or clock-sync) · feedback · wet" },
      { key: "REVERB",     desc: "Convolution reverb: wet level · size (impulse length)" },
      { key: "MASTER",     desc: "Master output gain 0–1.5, with brickwall limiter at –1 dBFS" },
    ],
    notes: [
      "Signal flow: drive → HPF → LPF → crush → width → (dry + delay + reverb) → gate → pump → limiter → master gain → output.",
      "Deck delay/reverb SENDS tap directly into the delay tank and convolver (parallel to master sends).",
      "Kill-Lo pad slams HPF; Kill-Hi pad slams LPF — both recover automatically.",
    ],
  },
  {
    title: "A/B BILATERAL LAYERS  (carrier engine)",
    rows: [
      { key: "Layer A",   desc: "Primary carrier: sine · pink noise · brown noise · band-limited · sample" },
      { key: "Layer B",   desc: "Secondary layer — enable in the classic panel or presets" },
    ],
    notes: [
      "Patterns: pure-alternation · mirrored-overlap · asymmetric · clustered · randomized · ping-pong-sweep · heartbeat · bilateral-roll.",
      "LAYER RHYTHM panel: set independent clock division or free-running Hz per layer.",
      "Layer A drives sidechain duck on Layer B (when sidechain is enabled).",
      "Layer B can have its own pattern, rate, carrier type, and sample.",
    ],
  },
  {
    title: "MODULATION (LFO, SEQ, ENV, MACROS)",
    rows: [
      { key: "LFO 1/2",   desc: "Sine/tri/saw/ramp/square LFOs — rate in Hz or clock-sync, shape, depth" },
      { key: "Sequencer",  desc: "16-step value sequencer with per-step gate + probability" },
      { key: "Env",        desc: "Envelope follower tracks master output energy" },
      { key: "Macro 1–4",  desc: "Assignable faders — drag-assign any param min/max per macro" },
    ],
    notes: [
      "Mod Matrix: up to 8 routings. Source × Destination × Depth (–1 to +1).",
      "Modulation runs at 50 Hz control rate (20 ms). Audio params use 12 ms smoothing.",
      "Right-click a sequencer step to set its probability (0 = never, 1 = always).",
    ],
  },
  {
    title: "GENERAL",
    rows: [
      { key: "?",          desc: "Toggle this help overlay" },
      { key: "Esc / click bg", desc: "Close this overlay" },
    ],
    notes: [
      "Knob interaction: drag up/down · Shift = fine · Ctrl/Cmd = coarse · scroll wheel · arrow keys when focused · double-click to reset.",
      "All state (BPM, FX, decks, snapshots, macros, LFOs, seq, routing) persists to localStorage.",
      "Record session: REC button captures live audio + event log (downloads as WebM + JSON).",
      "DJ / PRO toggle switches between streamlined DJ view (decks + pads prominent) and full PRO view (mod matrix + LFOs visible).",
    ],
  },
];

function KeyBadge({ k }: { k: string }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.18)",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      color: "rgba(255,255,255,0.85)",
      whiteSpace: "nowrap",
      minWidth: 90,
    }}>
      {k}
    </span>
  );
}

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1000,
        overflowY: "auto",
        padding: "24px 16px 48px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0c0e14",
          border: `1px solid ${ACCENT}`,
          borderRadius: 8,
          padding: "24px 28px",
          maxWidth: 680,
          width: "100%",
          fontFamily: "'JetBrains Mono', monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ color: ACCENT, fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "0.12em" }}>
              NEOSYNTH · REFERENCE
            </h2>
            <p style={{ color: DIM, fontSize: 9, margin: "4px 0 0", letterSpacing: "0.08em" }}>
              press <span style={{ color: ACCENT }}>?</span> or click outside to close
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 4,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: DIM, fontSize: 16,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              {/* Section header */}
              <div style={{
                fontSize: 9, color: ACCENT, letterSpacing: "0.14em",
                fontWeight: 700, marginBottom: 8,
                borderBottom: `1px solid rgba(34,211,238,0.15)`,
                paddingBottom: 4,
              }}>
                {sec.title}
              </div>

              {/* Rows */}
              {sec.rows.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                  {sec.rows.map((r) => (
                    <div key={r.key} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                      <KeyBadge k={r.key} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", flex: 1, lineHeight: 1.4 }}>
                        {r.desc}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {sec.notes && sec.notes.length > 0 && (
                <ul style={{
                  margin: 0, paddingLeft: 16,
                  display: "flex", flexDirection: "column", gap: 3,
                }}>
                  {sec.notes.map((n) => (
                    <li key={n} style={{
                      fontSize: 10, color: DIM, lineHeight: 1.5,
                      listStyleType: "disc",
                    }}>
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: `1px solid ${SECTION}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>
            neosynth · hardtechno live tool
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "6px 20px", borderRadius: 4,
              background: ACCENT, color: "#000",
              fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em", cursor: "pointer", border: "none",
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
