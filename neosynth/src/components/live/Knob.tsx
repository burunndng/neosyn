import { useRef, useCallback, useState } from "react";

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
}

const ACCENT = "hsl(192,87%,53%)";

export function Knob({
  value, min, max, defaultValue = (min + max) / 2,
  size = 52,
  label,
  valueLabel,
  color = ACCENT,
  onChange,
}: KnobProps) {
  const startY = useRef<number | null>(null);
  const startVal = useRef(value);
  const [isFocused, setIsFocused] = useState(false);

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
  }, [value, min, max, onChange]);

  const handleDoubleClick = useCallback(() => {
    onChange(clampValue(defaultValue));
  }, [onChange, defaultValue, min, max]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = (max - min) / 200;
    const direction = e.deltaY > 0 ? -1 : 1;
    const delta = step * direction * (e.shiftKey ? 0.25 : 1) * (e.ctrlKey || e.metaKey ? 4 : 1);
    onChange(clampValue(value + delta));
  }, [value, min, max, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [value, min, max, onChange]);

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ userSelect: "none" }}>
      <svg
        width={size} height={size}
        style={{
          cursor: "ns-resize",
          outline: isFocused ? `2px solid ${color}` : "none",
          borderRadius: "50%",
          padding: 2,
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
