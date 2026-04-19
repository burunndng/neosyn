import { useEffect, useRef, useState } from "react";
import { useLiveMode } from "@/lib/stores/liveMode";

const ACCENT = "hsl(192,87%,53%)";

function toDbLabel(db: number): string {
  if (db <= -60) return "-∞";
  return db.toFixed(1);
}

function dbToNorm(db: number): number {
  if (db <= -60) return 0;
  if (db >= 0) return 1;
  return (db + 60) / 60;
}

function dbToColor(db: number): string {
  if (db >= -1) return "#ef4444";
  if (db >= -6) return "#facc15";
  if (db >= -18) return ACCENT;
  return "#14b8a6";
}

export function OutputMeter() {
  const { getStereoMeter, isPlaying } = useLiveMode();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const peakLRef = useRef<HTMLDivElement>(null);
  const peakRRef = useRef<HTMLDivElement>(null);
  const [peakDb, setPeakDb] = useState({ l: -60, r: -60 });

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const held = { l: -60, r: -60, lAt: 0, rAt: 0 };
    let lastLabelUpdate = 0;

    const loop = () => {
      const m = getStereoMeter();
      if (!m) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const bufL = new Float32Array(m.l.fftSize);
      const bufR = new Float32Array(m.r.fftSize);
      m.l.getFloatTimeDomainData(bufL);
      m.r.getFloatTimeDomainData(bufR);

      let pkL = 0;
      let pkR = 0;
      for (let i = 0; i < bufL.length; i++) {
        const a = Math.abs(bufL[i]);
        if (a > pkL) pkL = a;
        const b = Math.abs(bufR[i]);
        if (b > pkR) pkR = b;
      }

      const lDb = pkL > 0 ? 20 * Math.log10(pkL) : -60;
      const rDb = pkR > 0 ? 20 * Math.log10(pkR) : -60;

      const now = performance.now();
      if (lDb > held.l) { held.l = lDb; held.lAt = now; }
      else if (now - held.lAt > 1200) { held.l = Math.max(-60, held.l - 0.3); }
      if (rDb > held.r) { held.r = rDb; held.rAt = now; }
      else if (now - held.rAt > 1200) { held.r = Math.max(-60, held.r - 0.3); }

      if (leftRef.current) {
        leftRef.current.style.width = `${dbToNorm(lDb) * 100}%`;
        leftRef.current.style.background = dbToColor(lDb);
      }
      if (rightRef.current) {
        rightRef.current.style.width = `${dbToNorm(rDb) * 100}%`;
        rightRef.current.style.background = dbToColor(rDb);
      }
      if (peakLRef.current) {
        peakLRef.current.style.left = `${dbToNorm(held.l) * 100}%`;
      }
      if (peakRRef.current) {
        peakRRef.current.style.left = `${dbToNorm(held.r) * 100}%`;
      }
      if (now - lastLabelUpdate > 120) {
        setPeakDb({ l: held.l, r: held.r });
        lastLabelUpdate = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, getStereoMeter]);

  const Bar = ({ barRef, peakRef }: { barRef: React.RefObject<HTMLDivElement>; peakRef: React.RefObject<HTMLDivElement> }) => (
    <div
      style={{
        position: "relative",
        height: 10,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 2,
        overflow: "hidden",
        flex: 1,
      }}
    >
      {/* dB gridlines */}
      {[-48, -36, -24, -12, -6, -3].map((db) => (
        <div
          key={db}
          style={{
            position: "absolute",
            left: `${dbToNorm(db) * 100}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(255,255,255,0.06)",
          }}
        />
      ))}
      <div ref={barRef} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "0%", background: ACCENT, transition: "width 0.03s linear, background-color 0.06s linear" }} />
      <div ref={peakRef} style={{ position: "absolute", top: 0, bottom: 0, left: "0%", width: 2, background: "rgba(255,255,255,0.85)" }} />
    </div>
  );

  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", minWidth: 200 }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.1em" }}>
          OUTPUT
        </span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
          L {toDbLabel(peakDb.l)} · R {toDbLabel(peakDb.r)} dB
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", width: 10 }}>L</span>
        <Bar barRef={leftRef} peakRef={peakLRef} />
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", width: 10 }}>R</span>
        <Bar barRef={rightRef} peakRef={peakRRef} />
      </div>
    </div>
  );
}
