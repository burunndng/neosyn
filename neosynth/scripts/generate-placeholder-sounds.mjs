import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "sounds");
const SR = 44100;

function encodeWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

function kickSweep(durSec, fStart, fEnd) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = fStart + (fEnd - fStart) * t;
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 4);
    out[i] = Math.sin(phase) * env * 0.9;
  }
  return out;
}

function noiseBurst(durSec, fadeExp) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.exp(-t * fadeExp);
    out[i] = (Math.random() * 2 - 1) * env * 0.6;
  }
  return out;
}

function filteredNoise(durSec, fadeExp, cutoffCoeff) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.exp(-t * fadeExp);
    const x = Math.random() * 2 - 1;
    prev = prev + cutoffCoeff * (x - prev);
    out[i] = prev * env * 0.7;
  }
  return out;
}

function acidLoop(durSec, freq) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const vib = 1 + 0.02 * Math.sin(2 * Math.PI * 6 * t);
    phase += (2 * Math.PI * freq * vib) / SR;
    const saw = phase / Math.PI - Math.floor(phase / Math.PI + 0.5);
    const env = 0.3 + 0.5 * Math.exp(-((t * 2) % 1) * 3);
    out[i] = saw * env * 0.5;
  }
  return out;
}

function riser(durSec) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = t * t;
    out[i] = (Math.random() * 2 - 1) * env * 0.5;
  }
  return out;
}

function subTone(durSec, freq) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    phase += (2 * Math.PI * freq) / SR;
    const env = Math.min(1, t * 10) * Math.min(1, (1 - t) * 10);
    out[i] = Math.sin(phase) * env * 0.8;
  }
  return out;
}

const files = [
  { name: "psy-kick-01.wav",      gen: () => kickSweep(0.18, 120, 40) },
  { name: "techno-kick-01.wav",   gen: () => kickSweep(0.22, 100, 30) },
  { name: "closed-hat-01.wav",    gen: () => noiseBurst(0.04, 60) },
  { name: "open-hat-01.wav",      gen: () => noiseBurst(0.18, 10) },
  { name: "shaker-01.wav",        gen: () => filteredNoise(0.05, 30, 0.9) },
  { name: "clap-808.wav",         gen: () => filteredNoise(0.08, 18, 0.4) },
  { name: "acid-loop-303.wav",    gen: () => acidLoop(0.6, 110) },
  { name: "noise-riser-01.wav",   gen: () => riser(2.0) },
  { name: "rumble-sub-01.wav",    gen: () => subTone(1.2, 42) },
];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let wrote = 0;
let skipped = 0;
for (const f of files) {
  const path = resolve(OUT_DIR, f.name);
  if (existsSync(path)) {
    console.log(`skip: ${f.name} (exists)`);
    skipped++;
    continue;
  }
  const samples = f.gen();
  writeFileSync(path, encodeWav(samples));
  console.log(`wrote: ${f.name} (${samples.length} samples, ${(samples.length / SR).toFixed(2)}s)`);
  wrote++;
}
console.log(`\n${wrote} written, ${skipped} skipped.`);
