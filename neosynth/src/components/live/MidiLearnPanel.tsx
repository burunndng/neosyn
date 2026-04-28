import { useEffect, useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { midiLearn, formatBinding, prettyParamKey } from "@/lib/audio/MidiLearn";
import { Trash2, Music4, AlertCircle } from "lucide-react";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.5)";
const ARMED = "#facc15";

export function MidiLearnPanel({ onClose }: { onClose: () => void }) {
  const {
    midiLearnEnabled, setMidiLearnEnabled,
    midiLearnTarget,
    midiBindingsTick,
  } = useLiveMode();
  const [accessRequested, setAccessRequested] = useState(false);
  const [accessGranted, setAccessGranted] = useState(midiLearn.hasAccess());
  const [supported] = useState(midiLearn.isSupported());

  // Trigger initial MIDI access request when the panel opens.
  useEffect(() => {
    if (!supported || accessGranted) return;
    setAccessRequested(true);
    void midiLearn.ensureAccess().then((ok) => {
      setAccessGranted(ok);
    });
  }, [supported, accessGranted]);

  // Re-render when bindings change (also picks up device connect/disconnect).
  void midiBindingsTick;

  const devices = midiLearn.getDevices();
  const bindings = midiLearn.getAllBindings();

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 1000, overflowY: "auto", padding: "24px 16px 48px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0c0e14",
          border: `1px solid ${ACCENT}`,
          borderRadius: 8,
          padding: "24px 28px",
          maxWidth: 620, width: "100%",
          fontFamily: "'JetBrains Mono', monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Music4 size={18} color={ACCENT} />
            <div>
              <h2 style={{ color: ACCENT, fontSize: 14, fontWeight: 700, margin: 0, letterSpacing: "0.12em" }}>
                MIDI LEARN
              </h2>
              <p style={{ color: DIM, fontSize: 9, margin: "2px 0 0", letterSpacing: "0.08em" }}>
                bind hardware controllers to any knob
              </p>
            </div>
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

        {/* Support / access state */}
        {!supported && (
          <div style={{
            padding: "12px 14px", borderRadius: 4,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#ef4444", fontSize: 11, marginBottom: 16,
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <AlertCircle size={14} />
            <span>This browser does not expose the Web MIDI API. Use Chrome or Edge for MIDI learn.</span>
          </div>
        )}
        {supported && !accessGranted && accessRequested && (
          <div style={{
            padding: "12px 14px", borderRadius: 4,
            background: "rgba(250,204,21,0.06)",
            border: "1px solid rgba(250,204,21,0.4)",
            color: ARMED, fontSize: 11, marginBottom: 16,
          }}>
            Waiting for MIDI permission… (browser may have shown a prompt)
          </div>
        )}

        {/* Learn mode toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderRadius: 5,
          background: midiLearnEnabled ? "rgba(250,204,21,0.06)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${midiLearnEnabled ? ARMED : "rgba(255,255,255,0.08)"}`,
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, color: midiLearnEnabled ? ARMED : "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: "0.08em" }}>
              {midiLearnEnabled ? "LEARN MODE: ON" : "LEARN MODE: OFF"}
            </div>
            <div style={{ fontSize: 9, color: DIM, marginTop: 4, lineHeight: 1.5 }}>
              {midiLearnEnabled
                ? midiLearnTarget
                  ? `Armed: ${prettyParamKey(midiLearnTarget)} — twist a hardware control to bind.`
                  : "Click any knob to arm it, then twist a hardware control."
                : "Toggle on to start binding hardware to UI knobs."}
            </div>
          </div>
          <button
            onClick={() => setMidiLearnEnabled(!midiLearnEnabled)}
            disabled={!supported}
            style={{
              padding: "8px 18px", borderRadius: 4,
              background: midiLearnEnabled ? ARMED : ACCENT,
              color: "#000",
              fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em", border: "none",
              cursor: supported ? "pointer" : "not-allowed",
              opacity: supported ? 1 : 0.4,
            }}
          >
            {midiLearnEnabled ? "STOP" : "START"}
          </button>
        </div>

        {/* Device list */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: ACCENT, letterSpacing: "0.14em", fontWeight: 700, marginBottom: 6 }}>
            INPUT DEVICES
          </div>
          {!accessGranted ? (
            <div style={{ fontSize: 10, color: DIM, padding: "8px 0" }}>
              {supported ? "(grant MIDI access to see devices)" : "(unsupported browser)"}
            </div>
          ) : devices.length === 0 ? (
            <div style={{ fontSize: 10, color: DIM, padding: "8px 0" }}>
              No MIDI input devices detected. Plug in a controller and it'll appear here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {devices.map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: "6px 10px", borderRadius: 3,
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${d.state === "connected" ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                    display: "flex", justifyContent: "space-between", fontSize: 10,
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>{d.name}</span>
                  <span style={{ color: d.state === "connected" ? "#22c55e" : DIM, letterSpacing: "0.06em" }}>
                    {d.state.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bindings list */}
        <div>
          <div style={{ fontSize: 9, color: ACCENT, letterSpacing: "0.14em", fontWeight: 700, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>BINDINGS · {bindings.length}</span>
            {bindings.length > 0 && (
              <button
                onClick={() => midiLearn.clearAllBindings()}
                style={{
                  padding: "2px 8px", borderRadius: 2,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444", fontSize: 8,
                  letterSpacing: "0.08em", cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                }}
              >
                CLEAR ALL
              </button>
            )}
          </div>
          {bindings.length === 0 ? (
            <div style={{ fontSize: 10, color: DIM, padding: "8px 0", lineHeight: 1.5 }}>
              No bindings yet. Turn on LEARN MODE, click a knob, then twist your hardware controller.
              <br />
              <span style={{ color: "rgba(255,255,255,0.3)" }}>
                Bindings persist across sessions (localStorage).
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {bindings.map(({ paramKey, binding }) => (
                <div
                  key={paramKey}
                  style={{
                    padding: "6px 10px", borderRadius: 3,
                    background: "rgba(34,211,238,0.04)",
                    border: "1px solid rgba(34,211,238,0.2)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    fontSize: 10,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: ACCENT, fontWeight: 600, letterSpacing: "0.04em" }}>
                      {prettyParamKey(paramKey)}
                    </span>
                    <span style={{ color: DIM, fontSize: 9 }}>
                      {formatBinding(binding)}
                    </span>
                  </div>
                  <button
                    onClick={() => midiLearn.clearBinding(paramKey)}
                    title="Remove binding"
                    style={{
                      padding: 4, borderRadius: 2,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: DIM, cursor: "pointer",
                      display: "flex", alignItems: "center",
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 9, color: DIM, lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 4, color: "rgba(255,255,255,0.6)", fontWeight: 600, letterSpacing: "0.08em" }}>
            HOW TO USE
          </div>
          <ol style={{ paddingLeft: 14, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <li>Click START to enable LEARN MODE.</li>
            <li>All learnable knobs glow yellow. Click one to arm it.</li>
            <li>Twist a knob/fader on your hardware controller.</li>
            <li>The binding is captured automatically. Repeat for more knobs.</li>
            <li>Click STOP to exit LEARN MODE — bindings stay active.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
