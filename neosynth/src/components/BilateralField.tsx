import { useRef, useEffect } from "react";
import type { BilateralPattern } from "@/lib/audio/AudioEngine";

interface BilateralFieldProps {
  isPlaying: boolean;
  rate: number;
  pattern: BilateralPattern;
}

const CYAN = "hsl(192, 87%, 53%)";

export function BilateralField({ isPlaying, rate, pattern }: BilateralFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 480, h: 220 });

  // DPR-aware sizing so the canvas stays crisp on retina screens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      sizeRef.current = { w, h };
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);
    return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = sizeRef.current.w;
    const H = sizeRef.current.h;
    const cx = W / 2;
    const cy = H / 2;

    const lx = W * 0.14;
    const rx = W * 0.86;
    const midX = cx;
    const amplitude = H * 0.28;

    function drawStatic() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const ellGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.43);
      ellGrad.addColorStop(0, "rgba(34,211,238,0.04)");
      ellGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ellGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, W * 0.42, H * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(34,211,238,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(lx, cy);
      ctx.bezierCurveTo(lx + (midX - lx) * 0.6, cy - amplitude, midX - (rx - midX) * 0.4, cy - amplitude, midX, cy);
      ctx.bezierCurveTo(midX + (rx - midX) * 0.4, cy + amplitude, rx - (rx - midX) * 0.6, cy + amplitude, rx, cy);
      ctx.strokeStyle = "rgba(34,211,238,0.30)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const lgDim = ctx.createRadialGradient(lx, cy, 0, lx, cy, 12);
      lgDim.addColorStop(0, "rgba(34,211,238,0.25)");
      lgDim.addColorStop(1, "transparent");
      ctx.fillStyle = lgDim;
      ctx.beginPath();
      ctx.arc(lx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,211,238,0.3)";
      ctx.fill();

      const rgDim = ctx.createRadialGradient(rx, cy, 0, rx, cy, 10);
      rgDim.addColorStop(0, "rgba(34,211,238,0.15)");
      rgDim.addColorStop(1, "transparent");
      ctx.fillStyle = rgDim;
      ctx.beginPath();
      ctx.arc(rx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,211,238,0.2)";
      ctx.fill();

      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(34,211,238,0.35)";
      ctx.textAlign = "center";
      ctx.fillText("L", lx, cy + H * 0.28);
      ctx.fillText("R", rx, cy + H * 0.28);
    }

    function drawAnimated(timestamp: number) {
      if (!ctx) return;
      if (startTimeRef.current === 0) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const interval = 1 / Math.max(0.1, rate);
      const cycle = elapsed % (interval * 2);
      const leftActive = cycle < interval;
      const progress = leftActive ? cycle / interval : (cycle - interval) / interval;
      const pulseAlpha = Math.sin(Math.PI * progress);

      ctx.clearRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.43);
      bgGrad.addColorStop(0, leftActive ? `rgba(34,211,238,${0.04 + pulseAlpha * 0.06})` : `rgba(34,211,238,${0.04 + pulseAlpha * 0.04})`);
      bgGrad.addColorStop(0.6, "rgba(34,211,238,0.02)");
      bgGrad.addColorStop(1, "transparent");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, W * 0.42, H * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34,211,238,${0.10 + pulseAlpha * 0.18})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 4 * pulseAlpha;
      ctx.stroke();
      ctx.restore();

      const waveAlpha = 0.25 + pulseAlpha * 0.45;
      ctx.save();
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 6 * pulseAlpha;
      ctx.beginPath();
      ctx.moveTo(lx, cy);
      ctx.bezierCurveTo(
        lx + (midX - lx) * 0.6, cy - amplitude,
        midX - (rx - midX) * 0.4, cy - amplitude,
        midX, cy
      );
      ctx.bezierCurveTo(
        midX + (rx - midX) * 0.4, cy + amplitude,
        rx - (rx - midX) * 0.6, cy + amplitude,
        rx, cy
      );
      ctx.strokeStyle = `rgba(34,211,238,${waveAlpha})`;
      ctx.lineWidth = 1.5 + pulseAlpha;
      ctx.stroke();
      ctx.restore();

      const ballX = leftActive
        ? lx + (rx - lx) * easeInOut(progress)
        : rx - (rx - lx) * easeInOut(progress);
      const pathT = leftActive ? easeInOut(progress) : 1 - easeInOut(progress);
      const ballY = cy + Math.sin(pathT * Math.PI) * (pathT < 0.5 ? -amplitude : amplitude) * (leftActive ? 1 : -1);

      const ballGrad = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, 18);
      ballGrad.addColorStop(0, "rgba(34,211,238,0.7)");
      ballGrad.addColorStop(0.4, "rgba(34,211,238,0.25)");
      ballGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,211,238,0.95)";
      ctx.fill();
      ctx.restore();

      const lPulse = leftActive ? pulseAlpha : 0;
      const lGrad = ctx.createRadialGradient(lx, cy, 0, lx, cy, 16 + lPulse * 8);
      lGrad.addColorStop(0, `rgba(34,211,238,${0.15 + lPulse * 0.6})`);
      lGrad.addColorStop(1, "transparent");
      ctx.fillStyle = lGrad;
      ctx.beginPath();
      ctx.arc(lx, cy, 16 + lPulse * 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      if (leftActive) { ctx.shadowColor = CYAN; ctx.shadowBlur = 10 * lPulse; }
      ctx.beginPath();
      ctx.arc(lx, cy, 4 + lPulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34,211,238,${0.4 + lPulse * 0.55})`;
      ctx.fill();
      ctx.restore();

      const rPulse = !leftActive ? pulseAlpha : 0;
      const rGrad = ctx.createRadialGradient(rx, cy, 0, rx, cy, 14 + rPulse * 8);
      rGrad.addColorStop(0, `rgba(34,211,238,${0.1 + rPulse * 0.6})`);
      rGrad.addColorStop(1, "transparent");
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(rx, cy, 14 + rPulse * 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      if (!leftActive) { ctx.shadowColor = CYAN; ctx.shadowBlur = 10 * rPulse; }
      ctx.beginPath();
      ctx.arc(rx, cy, 3.5 + rPulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34,211,238,${0.35 + rPulse * 0.55})`;
      ctx.fill();
      ctx.restore();

      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(34,211,238,${0.25 + lPulse * 0.55})`;
      ctx.fillText("L", lx, cy + H * 0.28);
      ctx.fillStyle = `rgba(34,211,238,${0.25 + rPulse * 0.55})`;
      ctx.fillText("R", rx, cy + H * 0.28);

      animRef.current = requestAnimationFrame(drawAnimated);
    }

    if (isPlaying) {
      startTimeRef.current = 0;
      animRef.current = requestAnimationFrame(drawAnimated);
    } else {
      cancelAnimationFrame(animRef.current);
      drawStatic();
    }

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, rate, pattern]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="bilateral-field-canvas"
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
