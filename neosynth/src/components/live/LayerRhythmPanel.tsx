import { useSynthParams, PATTERN_INFO } from "@/lib/stores/params";
import { CLOCK_DIVISIONS } from "@/lib/audio/MasterClock";
import type { ClockDivision } from "@/lib/audio/MasterClock";
import type { BilateralPattern } from "@/lib/audio/AudioEngine";

const ACCENT = "hsl(192,87%,53%)";
const DIM = "rgba(255,255,255,0.3)";

function MiniBtn({
  active,
  onClick,
  children,
  flex,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  flex?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: flex ? 1 : undefined,
        padding: "2px 6px",
        borderRadius: 2,
        fontSize: 8,
        background: active ? "rgba(34,211,238,0.12)" : "transparent",
        border: `1px solid ${active ? ACCENT : "rgba(255,255,255,0.07)"}`,
        color: active ? ACCENT : DIM,
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </button>
  );
}

function DivisionRow({
  value,
  onChange,
}: {
  value: ClockDivision;
  onChange: (v: ClockDivision) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {CLOCK_DIVISIONS.map((d) => (
        <MiniBtn key={d} active={value === d} onClick={() => onChange(d)}>
          {d}
        </MiniBtn>
      ))}
    </div>
  );
}

function LayerSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded"
      style={{
        background: "rgba(34,211,238,0.04)",
        border: "1px solid rgba(34,211,238,0.18)",
        minWidth: 140,
        flex: 1,
      }}
    >
      <span
        style={{
          fontSize: 8,
          color: ACCENT,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function LayerRhythmPanel() {
  const { params, updateParam } = useSynthParams();

  return (
    <div className="flex flex-col gap-2">
      <span
        style={{
          fontSize: 9,
          color: ACCENT,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          letterSpacing: "0.12em",
        }}
      >
        LAYER RHYTHM
      </span>

      <div className="flex gap-2">
        {/* Layer A */}
        <LayerSection label="LAYER A">
          <div className="flex gap-1">
            {(["loop", "oneshot"] as const).map((m) => (
              <MiniBtn
                key={m}
                active={params.layerAMode === m}
                onClick={() => updateParam("layerAMode", m)}
                flex
              >
                {m === "loop" ? "LOOP" : "SHOT"}
              </MiniBtn>
            ))}
          </div>

          <div className="flex gap-1">
            <MiniBtn
              active={params.layerADivision === null}
              onClick={() => updateParam("layerADivision", null)}
              flex
            >
              FREE
            </MiniBtn>
            <MiniBtn
              active={params.layerADivision !== null}
              onClick={() => updateParam("layerADivision", params.layerADivision ?? "1/4")}
              flex
            >
              SYNC
            </MiniBtn>
          </div>

          {params.layerADivision !== null && (
            <DivisionRow
              value={params.layerADivision}
              onChange={(d) => updateParam("layerADivision", d)}
            />
          )}

          {params.layerADivision === null && (
            <span
              style={{
                fontSize: 8,
                color: DIM,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {(params.layerARate ?? params.rate).toFixed(2)} Hz
            </span>
          )}
        </LayerSection>

        {/* Layer B */}
        <LayerSection label="LAYER B">
          {!params.layerBEnabled ? (
            <span style={{ fontSize: 8, color: DIM, fontFamily: "'JetBrains Mono', monospace" }}>
              B DISABLED
            </span>
          ) : (
            <>
              <div className="flex gap-1">
                {(["loop", "oneshot"] as const).map((m) => (
                  <MiniBtn
                    key={m}
                    active={params.layerBMode === m}
                    onClick={() => updateParam("layerBMode", m)}
                    flex
                  >
                    {m === "loop" ? "LOOP" : "SHOT"}
                  </MiniBtn>
                ))}
              </div>

              <div className="flex gap-1">
                <MiniBtn
                  active={params.layerBRate === null}
                  onClick={() =>
                    updateParam("layerBRate", params.layerBRate === null ? params.rate : null)
                  }
                  flex
                  title="Link / unlink Layer B rate from Layer A"
                >
                  {params.layerBRate === null ? "= A" : "FREE"}
                </MiniBtn>
              </div>

              <div className="flex gap-1">
                <MiniBtn
                  active={params.layerBDivision === null}
                  onClick={() => updateParam("layerBDivision", null)}
                  flex
                >
                  FREE
                </MiniBtn>
                <MiniBtn
                  active={params.layerBDivision !== null}
                  onClick={() => updateParam("layerBDivision", params.layerBDivision ?? "1/8")}
                  flex
                >
                  SYNC
                </MiniBtn>
              </div>

              {params.layerBDivision !== null && (
                <DivisionRow
                  value={params.layerBDivision}
                  onChange={(d) => updateParam("layerBDivision", d)}
                />
              )}

              <div className="flex gap-1">
                <MiniBtn
                  active={params.layerBPattern === null}
                  onClick={() =>
                    updateParam(
                      "layerBPattern",
                      params.layerBPattern === null ? params.pattern : null
                    )
                  }
                  flex
                >
                  {params.layerBPattern === null ? "↑ A" : "OWN"}
                </MiniBtn>
              </div>

              {params.layerBPattern !== null && (
                <div className="flex flex-col gap-0.5">
                  {(Object.keys(PATTERN_INFO) as BilateralPattern[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => updateParam("layerBPattern", p)}
                      style={{
                        textAlign: "left",
                        padding: "2px 4px",
                        borderRadius: 2,
                        fontSize: 8,
                        background:
                          params.layerBPattern === p ? "rgba(34,211,238,0.1)" : "transparent",
                        border: `1px solid ${
                          params.layerBPattern === p ? ACCENT : "rgba(255,255,255,0.04)"
                        }`,
                        color: params.layerBPattern === p ? ACCENT : "rgba(255,255,255,0.5)",
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {PATTERN_INFO[p].label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </LayerSection>
      </div>
    </div>
  );
}
