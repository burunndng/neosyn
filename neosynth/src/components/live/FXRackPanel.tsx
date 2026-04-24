import { useLiveMode } from "@/lib/stores/liveMode";
import { useSynthParams } from "@/lib/stores/params";
import { Knob } from "./Knob";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import type { ClockDivision } from "@/lib/audio/MasterClock";
import type { ReactNode } from "react";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.3)";

function FxModule({
  label,
  enabled,
  onToggle,
  children,
  width,
  active = false,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: ReactNode;
  width?: number;
  active?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded"
      style={{
        background: enabled ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${enabled ? "rgba(34,211,238,0.25)" : "rgba(255,255,255,0.07)"}`,
        boxShadow: active ? `0 0 10px rgba(34,211,238,0.25)` : "none",
        minWidth: width ?? 100,
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 8, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.08em" }}>
          {label}
        </span>
        <button
          onClick={onToggle}
          style={{
            width: 18, height: 16, borderRadius: 2,
            background: enabled ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${enabled ? ACCENT : "rgba(255,255,255,0.1)"}`,
            color: enabled ? ACCENT : DIM,
            fontSize: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {enabled ? "ON" : "OF"}
        </button>
      </div>
      {children}
    </div>
  );
}

function SyncRow({
  value,
  onChange,
  divisions = CLOCK_DIVISIONS as readonly ClockDivision[],
}: {
  value: ClockDivision;
  onChange: (v: ClockDivision) => void;
  divisions?: readonly ClockDivision[];
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {divisions.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          style={{
            padding: "1px 3px", borderRadius: 2, fontSize: 7,
            background: value === d ? "rgba(34,211,238,0.12)" : "transparent",
            border: `1px solid ${value === d ? ACCENT : "rgba(255,255,255,0.07)"}`,
            color: value === d ? ACCENT : DIM,
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

export function FXRackPanel() {
  const { fx, updateFx } = useLiveMode();
  const { params, updateParam } = useSynthParams();

  return (
    <div className="flex flex-col gap-2">
      <span style={{ fontSize: 9, color: ACCENT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.12em" }}>
        FX RACK
      </span>
      <div className="flex gap-2 flex-wrap">
        {/* Drive */}
        <FxModule
          label="DRIVE"
          enabled={fx.driveEnabled}
          onToggle={() => updateFx({ driveEnabled: !fx.driveEnabled })}
        >
          <Knob
            value={fx.driveAmount}
            min={0}
            max={1}
            size={44}
            valueLabel={`${Math.round(fx.driveAmount * 100)}%`}
            onChange={(v) => updateFx({ driveAmount: v })}
          />
        </FxModule>

        {/* HPF */}
        <FxModule
          label="HPF"
          enabled={fx.hpfEnabled}
          onToggle={() => updateFx({ hpfEnabled: !fx.hpfEnabled })}
        >
          <Knob
            value={fx.hpfFreq}
            min={20}
            max={2000}
            size={44}
            valueLabel={`${fx.hpfFreq.toFixed(0)}Hz`}
            onChange={(v) => updateFx({ hpfFreq: v })}
          />
        </FxModule>

        {/* LPF */}
        <FxModule
          label="LPF"
          enabled={fx.lpfEnabled}
          onToggle={() => updateFx({ lpfEnabled: !fx.lpfEnabled })}
        >
          <Knob
            value={fx.lpfFreq}
            min={200}
            max={20000}
            size={44}
            valueLabel={`${fx.lpfFreq.toFixed(0)}Hz`}
            onChange={(v) => updateFx({ lpfFreq: v })}
          />
        </FxModule>

        {/* Bitcrush */}
        <FxModule
          label="CRUSH"
          enabled={fx.crushEnabled}
          onToggle={() => updateFx({ crushEnabled: !fx.crushEnabled })}
        >
          <Knob
            value={fx.crushBits}
            min={1}
            max={12}
            size={44}
            valueLabel={`${fx.crushBits.toFixed(1)} bit`}
            onChange={(v) => updateFx({ crushBits: v })}
          />
        </FxModule>

        {/* Stereo Width */}
        <FxModule
          label="WIDTH"
          enabled={fx.widthEnabled}
          onToggle={() => updateFx({ widthEnabled: !fx.widthEnabled })}
        >
          <Knob
            value={fx.widthAmount}
            min={0}
            max={2}
            size={44}
            valueLabel={
              fx.widthAmount < 0.05
                ? "mono"
                : `${(fx.widthAmount * 100).toFixed(0)}%`
            }
            onChange={(v) => updateFx({ widthAmount: v })}
          />
        </FxModule>

        {/* Trance Gate */}
        <FxModule
          label="GATE"
          enabled={fx.gateEnabled}
          onToggle={() => updateFx({ gateEnabled: !fx.gateEnabled })}
          width={120}
          active={fx.gateEnabled}
        >
          <div className="flex justify-around">
            <Knob
              value={fx.gateDepth}
              min={0}
              max={1}
              size={40}
              label="DEPTH"
              valueLabel={fx.gateDepth.toFixed(2)}
              onChange={(v) => updateFx({ gateDepth: v })}
            />
          </div>
          <SyncRow
            value={fx.gateDiv}
            onChange={(d) => updateFx({ gateDiv: d })}
          />
        </FxModule>

        {/* Sidechain Pump */}
        <FxModule
          label="PUMP"
          enabled={fx.pumpEnabled}
          onToggle={() => updateFx({ pumpEnabled: !fx.pumpEnabled })}
          width={120}
          active={fx.pumpEnabled}
        >
          <div className="flex justify-around">
            <Knob
              value={fx.pumpDepth}
              min={0}
              max={1}
              size={40}
              label="DEPTH"
              valueLabel={fx.pumpDepth.toFixed(2)}
              onChange={(v) => updateFx({ pumpDepth: v })}
            />
          </div>
          <SyncRow
            value={fx.pumpDiv}
            onChange={(d) => updateFx({ pumpDiv: d })}
            divisions={["1/2", "1/4", "1/8", "1/16"] as const}
          />
        </FxModule>

        {/* Delay */}
        <FxModule
          label="DELAY"
          enabled={fx.delayEnabled}
          onToggle={() => updateFx({ delayEnabled: !fx.delayEnabled })}
          width={150}
        >
          <div className="flex justify-around">
            <Knob
              value={fx.delayTime}
              min={0.01}
              max={1.9}
              size={40}
              label="TIME"
              valueLabel={`${fx.delayTime.toFixed(2)}s`}
              onChange={(v) => updateFx({ delayTime: v })}
            />
            <Knob
              value={fx.delayFeedback}
              min={0}
              max={0.95}
              size={40}
              label="FB"
              valueLabel={fx.delayFeedback.toFixed(2)}
              onChange={(v) => updateFx({ delayFeedback: v })}
            />
            <Knob
              value={fx.delayWet}
              min={0}
              max={1}
              size={40}
              label="WET"
              valueLabel={fx.delayWet.toFixed(2)}
              onChange={(v) => updateFx({ delayWet: v })}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => updateFx({ delaySync: null })}
              style={{
                padding: "1px 3px", borderRadius: 2, fontSize: 7,
                background: fx.delaySync === null ? "rgba(34,211,238,0.12)" : "transparent",
                border: `1px solid ${fx.delaySync === null ? ACCENT : "rgba(255,255,255,0.07)"}`,
                color: fx.delaySync === null ? ACCENT : DIM,
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              FREE
            </button>
            {CLOCK_DIVISIONS.slice(0, 5).map((d) => (
              <button
                key={d}
                onClick={() => updateFx({ delaySync: d as ClockDivision })}
                style={{
                  padding: "1px 3px", borderRadius: 2, fontSize: 7,
                  background: fx.delaySync === d ? "rgba(34,211,238,0.12)" : "transparent",
                  border: `1px solid ${fx.delaySync === d ? ACCENT : "rgba(255,255,255,0.07)"}`,
                  color: fx.delaySync === d ? ACCENT : DIM,
                  cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </FxModule>

        {/* Reverb */}
        <FxModule
          label="REVERB"
          enabled={fx.reverbEnabled}
          onToggle={() => updateFx({ reverbEnabled: !fx.reverbEnabled })}
          width={120}
        >
          <div className="flex justify-around">
            <Knob
              value={fx.reverbWet}
              min={0}
              max={1}
              size={40}
              label="WET"
              valueLabel={fx.reverbWet.toFixed(2)}
              onChange={(v) => updateFx({ reverbWet: v })}
            />
            <Knob
              value={fx.reverbSize}
              min={0.5}
              max={5}
              size={40}
              label="SIZE"
              valueLabel={`${fx.reverbSize.toFixed(1)}s`}
              onChange={(v) => updateFx({ reverbSize: v })}
            />
          </div>
        </FxModule>

        {/* Master */}
        <FxModule
          label="MASTER"
          enabled={fx.limiterEnabled}
          onToggle={() => updateFx({ limiterEnabled: !fx.limiterEnabled })}
          width={120}
        >
          <div className="flex justify-around">
            <Knob
              value={fx.masterGain}
              min={0}
              max={1.5}
              size={40}
              label="VOL"
              valueLabel={`${(fx.masterGain * 100).toFixed(0)}`}
              onChange={(v) => updateFx({ masterGain: v })}
            />
          </div>
          <span style={{ fontSize: 7, color: DIM, fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
            {fx.limiterEnabled ? "LIMITER ON" : "NO LIMITER"}
          </span>
        </FxModule>

        {/* Sidechain — Layer A pulses duck Layer B (bilateral polyrhythm pump) */}
        <FxModule
          label="A→B DUCK"
          enabled={params.sidechainEnabled}
          onToggle={() => updateParam("sidechainEnabled", !params.sidechainEnabled)}
          width={120}
        >
          <div className="flex justify-around">
            <Knob
              value={params.sidechainDepth}
              min={0}
              max={1}
              size={40}
              label="DEPTH"
              valueLabel={params.sidechainDepth.toFixed(2)}
              onChange={(v) => updateParam("sidechainDepth", v)}
            />
            <Knob
              value={params.sidechainDuration}
              min={0.05}
              max={0.3}
              size={40}
              label="DUR"
              valueLabel={`${(params.sidechainDuration * 1000).toFixed(0)}ms`}
              onChange={(v) => updateParam("sidechainDuration", v)}
            />
          </div>
        </FxModule>
      </div>
    </div>
  );
}
