import { useRef, useCallback, useState, useEffect } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";
import { midiLearn } from "@/lib/audio/MidiLearn";

interface KnobProps {
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  size?: number;
  label?: string;
  valueLabel?: string;
  color?: string;
  onChange: (v: number) => void;
  /** Stable identifier for MIDI learn binding (e.g. "deck.0.gain"). */
  paramKey?: string;
}

const ACCENT = "hsl(192,87%,53%)";

export function Knob({
  value, min, max, defaultValue = (min + max) / 2,
  size = 52,
  label,
  valueLabel,
  color = ACCENT,
  onChange,
  paramKey,
}: KnobProps) {
  const startY = useRef<number | null>(null);
  const startVal = useRef(value);
  const [isFocused, setIsFocused] = useState(false);

  // ─── MIDI learn integration ───────────────────────────────────────────────
  const { midiLearnEnabled, midiLearnTarget, setMidiLearnTarget, midiBindingsTick } = useLiveMode();
  const isArmed = paramKey !== undefined && midiLearnTarget === paramKey;
  const binding = paramKey !== undefined ? midiLearn.getBinding(paramKey) : null;
  // Re-read binding whenever the global tick advances.
  void midiBindingsTick;

  // Use a ref for the latest min/max/onChange so the registered handler stays
  // stable across re-renders (avoids unregister/re-register churn).
  const rangeRef = useRef({ min, max, onChange });
  useEffect(() => { rangeRef.current = { min, max, onChange }; }, [min, max, onChange]);

  useEffect(() => {
    if (!paramKey) return;
    return midiLearn.registerKnob(paramKey, (norm) => {
      const r = rangeRef.current;
      const v = r.min + Math.max(0, Math.min(1, norm)) * (r.max - r.min);
      r.onChange(v);
    });
  }, [paramKey]);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const startAngle = 225;
  const totalArc = 270;
  const angleDeg = startAngle + norm * totalArc;
  const rad = (angleDeg * Math.PI) / 180;
  const r = size / 2 - 5;
  const cx = size / 2;
  const cy = size / 2;
  const px = cx + r * Math.sin(rad);
  const py = cy - r * Math.cos(rad);

  function arcPath(fromAngle: number, toAngle: number, radius: number) {
    const fa = (fromAngle * Math.PI) / 180;
    const ta = (toAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.sin(fa);
    const y1 = cy - radius * Math.cos(fa);
    const x2 = cx + radius * Math.sin(ta);
    const y2 = cy - radius * Math.cos(ta);
    const large = toAngle - fromAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  }

  const trackPath = arcPath(startAngle, startAngle + totalArc, r);
  const valuePath = norm > 0.001 ? arcPath(startAngle, startAngle + norm * totalArc, r) : null;

  const clampValue = (v: number) => Math.max(min, Math.min(max, v));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Learn mode hijacks click — arm/disarm this knob instead of dragging.
    if (midiLearnEnabled && paramKey) {
      e.preventDefault();
      e.stopPropagation();
      setMidiLearnTarget(midiLearnTarget === paramKey ? null : paramKey);
      return;
    }
    e.preventDefault();
    startY.current = e.clientY;
    startVal.current = value;

    const onMove = (ev: PointerEvent) => {
      const dy = startY.current! - ev.clientY;
      let deltaScale = 1;
      if (ev.shiftKey) deltaScale = 0.25;
      if (ev.ctrlKey || ev.metaKey) deltaScale = 4;
      const delta = (dy / 150) * (max - min) * deltaScale;
      onChange(clampValue(startVal.current + delta));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [value, min, max, onChange, midiLearnEnabled, paramKey, midiLearnTarget, setMidiLearnTarget]);

  const handleDoubleClick = useCallback(() => {
    if (midiLearnEnabled) return;
    onChange(clampValue(defaultValue));
  }, [onChange, defaultValue, min, max, midiLearnEnabled]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (midiLearnEnabled) return;
    e.preventDefault();
    const step = (max - min) / 200;
    const direction = e.deltaY > 0 ? -1 : 1;
    const delta = step * direction * (e.shiftKey ? 0.25 : 1) * (e.ctrlKey || e.metaKey ? 4 : 1);
    onChange(clampValue(value + delta));
  }, [value, min, max, onChange, midiLearnEnabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (midiLearnEnabled) return;
    const step = (max - min) / 200;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const delta = step * (e.shiftKey ? 0.25 : 1) * (e.ctrlKey || e.metaKey ? 4 : 1);
      onChange(clampValue(value + delta));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const delta = step * (e.shiftKey ? 0.25 : 1) * (e.ctrlKey || e.metaKey ? 4 : 1);
      onChange(clampValue(value - delta));
    }
  }, [value, min, max, onChange, midiLearnEnabled]);

  // Visual states
  const learnHaloColor = isArmed ? "#facc15" : binding ? color : "transparent";
  const learnHaloOpacity = isArmed ? 0.85 : binding ? 0.45 : 0;

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ userSelect: "none", position: "relative" }}>
      <svg
        width={size} height={size}
        style={{
          cursor: midiLearnEnabled && paramKey ? "crosshair" : "ns-resize",
          outline: isFocused ? `2px solid ${color}` : "none",
          borderRadius: "50%",
          padding: 2,
          // Learn-mode glow: yellow when armed, accent-tinted when bound, none otherwise.
          boxShadow: learnHaloOpacity > 0
            ? `0 0 ${isArmed ? 12 : 6}px ${learnHaloColor}`
            : "none",
          background: midiLearnEnabled && paramKey
            ? "rgba(250,204,21,0.04)"
            : "transparent",
          transition: "box-shadow 0.15s, background 0.15s",
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <circle cx={cx} cy={cy} r={r + 3} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} strokeLinecap="round" />
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        )}
        <circle cx={px} cy={py} r={2.5} fill={color} />
      </svg>
      {/* Bound-MIDI badge */}
      {binding && !isArmed && (
        <span
          style={{
            position: "absolute",
            top: 1, right: 1,
            fontSize: 7,
            padding: "0 3px",
            borderRadius: 2,
            background: "rgba(34,211,238,0.2)",
            color: ACCENT,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.04em",
            pointerEvents: "none",
          }}
          title={`MIDI: ch${binding.channel + 1} CC${binding.cc}`}
        >
          M
        </span>
      )}
      {isArmed && (
        <span
          style={{
            position: "absolute",
            top: 1, right: 1,
            fontSize: 7,
            padding: "0 3px",
            borderRadius: 2,
            background: "#facc15",
            color: "#000",
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.04em",
            pointerEvents: "none",
          }}
          title="Twist a hardware MIDI control to bind"
        >
          ?
        </span>
      )}
      {valueLabel !== undefined && (
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
          {valueLabel}
        </span>
      )}
      {label && (
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      )}
    </div>
  );
}
