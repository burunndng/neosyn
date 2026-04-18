import { useRef, useCallback } from "react";

interface KnobProps {
  value: number;
  min: number;
  max: number;
  size?: number;
  label?: string;
  valueLabel?: string;
  color?: string;
  onChange: (v: number) => void;
}

const ACCENT = "hsl(192,87%,53%)";

export function Knob({
  value, min, max,
  size = 52,
  label,
  valueLabel,
  color = ACCENT,
  onChange,
}: KnobProps) {
  const startY = useRef<number | null>(null);
  const startVal = useRef(value);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // 270° arc starting at 225° (bottom-left) → 135° (bottom-right)
  const startAngle = 225;
  const totalArc = 270;
  const angleDeg = startAngle + norm * totalArc;
  const rad = (angleDeg * Math.PI) / 180;
  const r = size / 2 - 5;
  const cx = size / 2;
  const cy = size / 2;
  const px = cx + r * Math.sin(rad);
  const py = cy - r * Math.cos(rad);

  // Track arc path (225° → 135°, 270° sweep)
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

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startY.current = e.clientY;
    startVal.current = value;

    const onMove = (ev: MouseEvent) => {
      const dy = startY.current! - ev.clientY;
      const delta = (dy / 150) * (max - min);
      onChange(Math.max(min, Math.min(max, startVal.current + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [value, min, max, onChange]);

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ userSelect: "none" }}>
      <svg
        width={size} height={size}
        style={{ cursor: "ns-resize" }}
        onMouseDown={onMouseDown}
      >
        {/* Background circle */}
        <circle cx={cx} cy={cy} r={r + 3} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* Track arc */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} strokeLinecap="round" />
        {/* Value arc */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        )}
        {/* Pointer dot */}
        <circle cx={px} cy={py} r={2.5} fill={color} />
      </svg>
      {valueLabel !== undefined && (
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
          {valueLabel}
        </span>
      )}
      {label && (
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      )}
    </div>
  );
}
