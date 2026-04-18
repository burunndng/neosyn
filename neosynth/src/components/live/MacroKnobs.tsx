import { useLiveMode } from "@/lib/stores/liveMode";
import { Knob } from "./Knob";

const ACCENT = "hsl(192,87%,53%)";

export function MacroKnobs() {
  const { macros, setMacroValue, updateMacro } = useLiveMode();

  return (
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
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: "center",
              textTransform: "uppercase",
              fontWeight: 600,
              letterSpacing: "0.1em",
              padding: "0 2px",
            }}
            placeholder={m.label}
          />
          <Knob
            value={m.value}
            min={0}
            max={1}
            size={64}
            valueLabel={m.value.toFixed(2)}
            onChange={(v) => setMacroValue(idx, v)}
          />
        </div>
      ))}
    </div>
  );
}
