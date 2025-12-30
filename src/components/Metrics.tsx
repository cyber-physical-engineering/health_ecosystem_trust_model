import { useMemo } from "react";
import { useStore } from "@state/store";
import { FEATURE_NEW_ROI_MATH, DEV } from "@domain/flags";
import { interopFactor, cadenceFactor as cadenceFactorV2, clamp as clampV2, volumeBoost, partyDrag, speedToPilotBoost, speedToPilotScore01 } from "@domain/math";
import { narrativeToScore, strategicFitOf } from "@domain/roi";
import { useEffect } from "react";

export function Metrics() {
  const actors = useStore(s => s.actors);
  const visibleFlows = useStore(s => s.visibleFlows)();

  const avgTrust = useMemo(() => {
    if (actors.length === 0) return 0;
    return Math.round(actors.reduce((a, b) => a + (b.trustScore ?? 0), 0) / actors.length);
  }, [actors]);

  const topTrustGap = useMemo(() => {
    return [...visibleFlows].sort((a, b) => (b.trustGap ?? 0) - (a.trustGap ?? 0)).slice(0, 3);
  }, [visibleFlows]);

  const disputeRisk = useMemo(() => {
    return visibleFlows.reduce((sum, e) => {
      const f = e.friction ?? 0, t = e.trustGap ?? 0, s = e.sensitivity ?? 0;
      return sum + (f * t * s) / 10000;
    }, 0).toFixed(2);
  }, [visibleFlows]);

  // Dollar-focused metrics
  const moneyEdges = useMemo(() => visibleFlows.filter(e => e.type === "money"), [visibleFlows]);
  const isEstimate = (e: (typeof moneyEdges)[number] | any) => ((e as any)?.valueBasis === "estimate");
  const estimateDataDollarToggle = useStore(s => (s as any).estimateDataDollarToggle as boolean);
  // Unified amount helper: prefer economicValueUSD, else dollarValue, else unitCount×unitValueUSD, else 0
  const amountInfo = (e: any) => {
    const explicit = (e?.economicValueUSD as number | undefined);
    if (typeof explicit === "number" && !Number.isNaN(explicit)) {
      const estimated = (e?.valueBasis === "estimate");
      const scale = (e?.marketScale as string | undefined);
      const factor = scale === "high" ? 20 : scale === "medium" ? 5 : 1;
      return { amountUSD: explicit * factor, estimated };
    }
    const dollar = (e?.dollarValue as number | undefined);
    if (typeof dollar === "number" && !Number.isNaN(dollar)) {
      return { amountUSD: dollar, estimated: false };
    }
    const units = (e?.unitCount as number | undefined);
    const unitVal = (e?.unitValueUSD as number | undefined);
    if (estimateDataDollarToggle && typeof units === "number" && typeof unitVal === "number") {
      return { amountUSD: units * unitVal, estimated: true };
    }
    return { amountUSD: 0, estimated: false };
  };
  // Interop complexity → friction multiplier
  const interopMultiplier = (e: any) => interopFactor((e?.interopComplexity as string | undefined) || "JSON");
  // Base and adjusted preventable friction ($)
  const baseAssuranceNeed = (e: any) => {
    const { amountUSD } = amountInfo(e);
    const f = (e?.friction ?? 0) / 100;
    const t = (e?.trustGap ?? 0) / 100;
    return amountUSD * f * t;
  };
  const adjustedAssuranceNeed = (e: any) => baseAssuranceNeed(e) * interopMultiplier(e);
  // Integration penalty in $ is the added cost from interop complexity
  const integrationPenaltyUSD = (e: any) => {
    const base = baseAssuranceNeed(e);
    const mult = interopMultiplier(e);
    return base * Math.max(0, mult - 1);
  };
  // Audit pressure ($)
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
  const cadenceFactorLegacy = (cad: string | undefined) => cad === "quarterly" ? 4 : 1; // ad-hoc/annual → 1
  const auditPressureForAuditEdge = (e: any) => {
    const findings = Math.max(1, (e?.findingsOpen ?? 1) as number);
    const avg = Math.max(0, (e?.avgAuditCostUSD ?? 50000) as number);
    const cad = ((e?.auditCadence as string | undefined) ?? (e?.cadence as string | undefined));
    if (FEATURE_NEW_ROI_MATH) {
      const factor = cadenceFactorV2(cad);
      const sites = Math.max(1, (e?.siteCount ?? 1) as number);
      const vio = Math.max(0, Math.min(1, (e?.violationRate ?? 0.0) as number));
      const rawAudit = factor * findings * avg * sites;
      const capLow = 250000, capHigh = 1000000, softness = 0.25;
      const softPart = Math.max(0, rawAudit - capLow);
      let pressure = Math.min(rawAudit, capHigh) - softness * softPart;
      pressure = Math.max(0, pressure);
      pressure *= (1 + 0.15 * vio);
      return clampV2(pressure, 25000, 1000000);
    } else {
      const cost = clamp(avg, 25000, 100000);
      const factor = cadenceFactorLegacy(cad);
      return Math.max(0, findings) * factor * cost;
    }
  };
  const auditPressureByEdge = (e: any) => {
    // Direct audit pressure if this is an audit edge
    let total = 0;
    if (e?.type === "audit") total += auditPressureForAuditEdge(e);
    // Attribute linked audit pressure to related non-audit edges
    const lid = (e?.linkedFlowId as string | undefined) || null;
    for (const f of visibleFlows) {
      if (f.type !== "audit") continue;
      const fl = (f as any).linkedFlowId as string | undefined;
      if (f.id === e.id || f.id === lid || (fl && (fl === e.id || fl === lid))) {
        total += auditPressureForAuditEdge(f);
      }
    }
    return total;
  };
  const assuranceNeedByEdge = (e: any) => adjustedAssuranceNeed(e);
  // Preventable Friction across all visible flows (money + data with estimates when present)
  const totalAssuranceNeed = useMemo(() => visibleFlows.reduce((s, e) => s + assuranceNeedByEdge(e), 0), [visibleFlows]);
  // Audit Pressure total across visible edges (attributed from audit edges)
  const totalAuditPressure = useMemo(() => visibleFlows.reduce((s, e) => s + auditPressureByEdge(e), 0), [visibleFlows]);
  const topDollarNeed = useMemo(() => {
    return [...visibleFlows]
      .map(e => ({ e, need: assuranceNeedByEdge(e), amount: amountInfo(e) }))
      .sort((a, b) => b.need - a.need)
      .slice(0, 3);
  }, [visibleFlows]);
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const actorNameById = useMemo(() => new Map(actors.map(a => [a.id, a.name])), [actors]);
  const topTargets = useMemo(() => {
    return [...visibleFlows]
      .map(e => ({ e, need: assuranceNeedByEdge(e), amount: amountInfo(e) }))
      .sort((a, b) => b.need - a.need)
      .slice(0, 5);
  }, [visibleFlows]);
  // Legal exposure (money flows only)
  const legalExpenseByEdge = (e: (typeof moneyEdges)[number]) => {
    const tx = ((e as any).txCount ?? null) as number | null;
    const dispute = ((e as any).disputeRatePct ?? 0) / 100;
    const litig = ((e as any).litigationRatePct ?? 0) / 100;
    const cDispute = ((e as any).avgDisputeCostUSD ?? 0) as number;
    const cLit = ((e as any).avgLitigationCostUSD ?? 0) as number;
    if (!tx) return 0;
    const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
    return tx * expectedCostPerTx;
  };
  const totalLegalExposure = useMemo(() => moneyEdges.reduce((s, e) => s + legalExpenseByEdge(e), 0), [moneyEdges]);
  const topLegalExposure = useMemo(() => {
    return [...moneyEdges]
      .map(e => ({ e, cost: legalExpenseByEdge(e) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);
  }, [moneyEdges]);
  const ztlEligible = useMemo(
    () => visibleFlows.filter(e => (e.trustGap ?? 0) >= 60 && (e.sensitivity ?? 0) >= 60),
    [visibleFlows]
  );
  // ROI Composite and Speed-to-Pilot
  const legalExpenseByAnyEdge = (e: any) => (e?.type === "money" ? legalExpenseByEdge(e as any) : 0);
  const speedScore = (e: any) => {
    const mult = interopMultiplier(e);
    // Counterparties: 2 baseline; +1 if any linked audit present
    const lid = (e?.linkedFlowId as string | undefined) || null;
    const hasAudit = visibleFlows.some(f => f.type === "audit" && ((f as any).linkedFlowId === e.id || (f as any).linkedFlowId === lid || f.id === e.id || f.id === lid));
    const parties = 2 + (hasAudit ? 1 : 0);
    return 1 / (mult * parties);
  };
  // ROI base with flag-guarded behavior
  const baseRoi = (e: any) => {
    const need = adjustedAssuranceNeed(e);
    const legal = legalExpenseByAnyEdge(e);
    const audit = auditPressureByEdge(e);
    const penalty = integrationPenaltyUSD(e);
    const regW = Number.isFinite((e?.regExposureWeight as any)) ? (e.regExposureWeight as number) : 1.0;
    if (FEATURE_NEW_ROI_MATH) {
      return need * 0.35 * regW + legal * 0.20 + audit * 0.35 - penalty * 0.10;
    }
    return need * 0.35 + legal * 0.20 + audit * 0.35 - penalty * 0.10;
  };

  const roiComposite = (e: any) => {
    if (FEATURE_NEW_ROI_MATH) {
      const base = baseRoi(e);
      const vb = volumeBoost((e as any).txCount);
      const pd = partyDrag((e as any).counterpartyCount);
      return (base * vb * pd);
    }
    return baseRoi(e);
  };
  const roiNormalized = (e: any) => {
    const { amountUSD } = amountInfo(e);
    const denom = Math.sqrt(Math.max(1, (amountUSD ?? 0)));
    return roiComposite(e) / denom;
  };
  // Narrative value → scalar used only for ranking/visualization
  const narrativeScore = (e: any) => narrativeToScore((e as any).narrativeValue as any);
  const topRoiNarrative = useMemo(() => {
    return [...visibleFlows]
      .map(e => {
        const roi = roiNormalized(e);
        const n = narrativeScore(e);
        const sf = strategicFitOf(e);
        const sp = speedToPilotScore01((e as any).avgCycleDays, (e as any).interopComplexity, (e as any).counterpartyCount);
        const isAudit = e.type === "audit";
        const sc = (e as any).siteCount ?? 1;
        const fnd = (e as any).findingsOpen ?? 0;
        // Turn down audit dominance unless strong signal (>=3 sites AND >=3 findings)
        const auditGuard = isAudit && (sc < 3 || fnd < 3) ? 0.90 : 1.00;
        // Bump speed-to-pilot weight to +0.02×speed (visible tie-breaker)
        const combined = (roi * (n * 1.10) * (sf * 1.05) + 0.02 * sp) * auditGuard;
        return { e, roi, n, sf, sp, combined };
      })
      .sort((a, b) => b.combined - a.combined)
      .slice(0, 10);
  }, [visibleFlows]);

  // ROI vs Narrative scatter chart data
  const scatterData = useMemo(() => {
    const rows = [...visibleFlows].map(e => {
      const roi = roiNormalized(e);
      const n = narrativeScore(e);
      return { e, roi, n };
    });
    const maxX = rows.reduce((m, r) => Math.max(m, r.roi), 1);
    const maxY = 1.0; // narrativeScore is [0,1]
    return { rows, maxX, maxY };
  }, [visibleFlows]);

  const colorForNarrative = (v?: string) => v === "proof" ? "#10b981" : v === "innovation" ? "#60a5fa" : v === "compliance" ? "#f59e0b" : v === "cost" ? "#ef4444" : "#9ca3af";
  const ztlPriority = useMemo(() => {
    return [...ztlEligible]
      .map(e => ({ e, roi: roiNormalized(e), amount: amountInfo(e) }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);
  }, [ztlEligible]);
  const topROI = useMemo(() => {
    return [...visibleFlows]
      .map(e => ({ e, roi: roiNormalized(e) }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5);
  }, [visibleFlows]);
  const topSpeed = useMemo(() => {
    return [...visibleFlows]
      .map(e => ({
        e,
        spd: speedToPilotScore01(
          (e as any).avgCycleDays,
          (e as any).interopComplexity,
          (e as any).counterpartyCount
        )
      }))
      .sort((a, b) => b.spd - a.spd)
      .slice(0, 5);
  }, [visibleFlows]);

  // Diagnostics: top 10 combined and distributions
  useEffect(() => {
    try {
      const rows = [...visibleFlows]
        .map(e => {
          const roi = roiNormalized(e);
          const n = narrativeScore(e);
          const sf = strategicFitOf(e);
          const sp = speedToPilotScore01((e as any).avgCycleDays, (e as any).interopComplexity, (e as any).counterpartyCount);
          const isAudit = e.type === "audit";
          const sc = (e as any).siteCount ?? 1;
          const fnd = (e as any).findingsOpen ?? 0;
          const guard = (isAudit && sc <= 2 && fnd <= 2) ? 0.85 : 1.0;
          const combined = (roi * n * sf + 1e-3 * sp) * guard;
          return { label: e.label || e.type, combined, roi, n, sf, sp };
        })
        .sort((a, b) => b.combined - a.combined)
        .slice(0, 10);
      console.table(rows.map(r => ({ label: r.label, ROI_norm: Math.round(r.roi), narrative: r.n.toFixed(2), strategicFit: r.sf.toFixed(2), speed: r.sp.toFixed(3), combined: r.combined.toFixed(2) })));

      const cycleDays = [...visibleFlows].map(e => (e as any).avgCycleDays).filter((x: any) => typeof x === "number");
      const counterparties = [...visibleFlows].map(e => (e as any).counterpartyCount ?? 2);
      const siteCount = [...visibleFlows].filter(e => e.type === "audit").map(e => (e as any).siteCount ?? 1);
      if (cycleDays.length > 0) {
        console.log("Distributions", {
          cycleDays: { min: Math.min(...cycleDays as number[]), max: Math.max(...cycleDays as number[]) },
          counterparties: { min: Math.min(...(counterparties as number[])), max: Math.max(...(counterparties as number[])) },
          siteCount: { min: siteCount.length ? Math.min(...(siteCount as number[])) : 0, max: siteCount.length ? Math.max(...(siteCount as number[])) : 0 }
        });
      }
    } catch {}
  }, [visibleFlows]);

  // Compliance counters (sync with canvas/legend semantics)
  const actorById = useMemo(() => new Map(actors.map(a => [a.id, a])), [actors]);
  const isCE = (t?: string) => ["Provider","Hospital","Payer","PharmaMfg"].includes(String(t));
  const isBA = (t?: string) => ["PBM","EHRVendor","CRO","CMO","Lab","Pharmacy"].includes(String(t));
  const baaGaps = useMemo(() => {
    return visibleFlows.filter(f => f.type === "data" && (f.sensitivity ?? 0) >= 60 && isCE(actorById.get(f.from)?.type) && isBA(actorById.get(f.to)?.type)).length;
  }, [visibleFlows, actorById]);
  const linkedPairs = useMemo(() => {
    const set = new Set<string>();
    for (const f of visibleFlows) {
      const lid = (f as any).linkedFlowId as string | undefined;
      if (!lid) continue;
      const key = [f.id, lid].sort().join("|");
      set.add(key);
    }
    return set.size;
  }, [visibleFlows]);

  const copyTopTargets = async () => {
    try {
      const lines = topTargets.map(({ e, need }, idx) => {
        const from = actorNameById.get(e.from) || "?";
        const to = actorNameById.get(e.to) || "?";
        return `${idx + 1}. ${from} -> ${to} — ${e.label || e.type} — ${fmt(need)}`;
      });
      const text = `Top targets (BD focus)\n${lines.join("\n")}`;
      await (navigator as any).clipboard?.writeText?.(text);
    } catch {}
  };

  return (
    <div className="panel metrics">
      <div className="item" style={{ justifyContent: "flex-end" }}>
        {FEATURE_NEW_ROI_MATH && (
          <span title="v2 math: scale, coordination drag, cycle velocity, GxP weight" style={{ fontSize: 11, padding: "2px 6px", border: "1px solid var(--muted)", borderRadius: 10, opacity: 0.8 }}>
            Math: v2
          </span>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">ROI vs Narrative (scatter)</div>
        {scatterData.rows.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <div style={{ marginTop: 6, background: "var(--panel-elevated)", padding: 8, borderRadius: 6 }}>
            {(() => {
              const width = 360, height = 220, padL = 36, padB = 28, padT = 8, padR = 8;
              const innerW = width - padL - padR, innerH = height - padT - padB;
              const sx = (x: number) => padL + (innerW * x) / Math.max(1, scatterData.maxX);
              const sy = (y: number) => padT + innerH - (innerH * y) / Math.max(0.0001, scatterData.maxY);
              const ticksX = 4;
              const ticks = Array.from({ length: ticksX + 1 }, (_, i) => (scatterData.maxX * i) / ticksX);
              return (
                <svg width={width} height={height} style={{ width: "100%", height: "auto" }}>
                  <rect x={padL} y={padT} width={innerW} height={innerH} fill="none" stroke="rgba(255,255,255,0.1)" />
                  {ticks.map((t, i) => (
                    <g key={i}>
                      <line x1={sx(t)} y1={padT} x2={sx(t)} y2={padT + innerH} stroke="rgba(255,255,255,0.06)" />
                      <text x={sx(t)} y={padT + innerH + 14} fontSize={10} textAnchor="middle" fill="var(--muted)">{Math.round(t)}</text>
                    </g>
                  ))}
                  {[0, 0.5, 1.0].map((t, i) => (
                    <g key={i}>
                      <line x1={padL} y1={sy(t)} x2={padL + innerW} y2={sy(t)} stroke="rgba(255,255,255,0.06)" />
                      <text x={padL - 6} y={sy(t) + 3} fontSize={10} textAnchor="end" fill="var(--muted)">{t.toFixed(1)}</text>
                    </g>
                  ))}
                  <text x={padL + innerW / 2} y={height - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">ROI_normalized</text>
                  <text x={12} y={padT + 10} fontSize={11} textAnchor="start" fill="var(--muted)">narrativeScore</text>
                  {scatterData.rows.map(({ e, roi, n }, idx) => {
                    const v = (e as any).narrativeValue as string | undefined;
                    const color = colorForNarrative(v);
                    const cx = sx(roi);
                    const cy = sy(n);
                    return (
                      <g key={e.id}>
                        <circle cx={cx} cy={cy} r={3} fill={color} />
                        {/* compact label */}
                        <text x={cx + 5} y={cy - 4} fontSize={9} fill="var(--muted)">
                          {(e as any).label || (e as any).type}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">Top 10: ROI_normalized × Narrative</div>
        {topRoiNarrative.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <table className="small" style={{ marginTop: 6, width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Edge</th><th>ROI_norm</th><th>Narrative</th><th>Combined</th>
              </tr>
            </thead>
            <tbody>
              {topRoiNarrative.map(({ e, roi, n, combined }, i) => (
                <tr key={e.id}>
                  <td>{(e as any).label || (e as any).type}</td>
                  <td>{roi.toFixed(2)}</td>
                  <td>{n.toFixed(2)}</td>
                  <td>{combined.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="item"><span>Avg Trust (visible actors)</span><b>{avgTrust}</b></div>
      <div className="item">
        <span>
          Friction Risk Index (relative)<sup style={{ marginLeft: 4, opacity: 0.7 }}>1</sup>
        </span>
        <b>{disputeRisk}</b>
      </div>
      <div className="item">
        <span>BAA gap edges (visible)</span>
        <b>{baaGaps}</b>
      </div>
      <div className="item">
        <span>Linked flow pairs (visible)</span>
        <b>{linkedPairs}</b>
      </div>
      <div className="item">
        <span>
          Preventable Friction ($, sum)<sup style={{ marginLeft: 4, opacity: 0.7 }}>2</sup>
        </span>
        <b>{fmt(totalAssuranceNeed)}</b>
      </div>
      <div className="item">
        <span>Audit Pressure ($, sum)</span>
        <b>{fmt(totalAuditPressure)}</b>
      </div>
      <div className="item">
        <span>
          Legal Exposure ($, sum)<sup style={{ marginLeft: 4, opacity: 0.7 }}>3</sup>
        </span>
        <b>{fmt(totalLegalExposure)}</b>
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">Top 3 edges by Trust Gap</div>
        <ul className="small" style={{ marginTop: 4 }}>
          {topTrustGap.map(e => (
            <li key={e.id}>
              {e.label || e.type} — TG {e.trustGap ?? 0}, Sens {e.sensitivity ?? 0}, Fric {e.friction ?? 0}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">ZTL priority (eligible edges, ROI‑normalized)</div>
        {ztlPriority.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <ul className="small" style={{ marginTop: 4 }}>
            {ztlPriority.map(({ e, roi, amount }) => (
              <li key={e.id}>
                {actorNameById.get(e.from) || "?"} → {actorNameById.get(e.to) || "?"} — {e.label || e.type} — ROI (norm) {fmt(roi)}{(amount?.estimated || isEstimate(e)) ? " (est.)" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">Top ROI (normalized)</div>
        {topROI.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <ul className="small" style={{ marginTop: 4 }}>
            {topROI.map(({ e, roi }) => (
              <li key={e.id}>
                {actorNameById.get(e.from) || "?"} → {actorNameById.get(e.to) || "?"} — {e.label || e.type} — {fmt(roi)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {DEV && (
        <div style={{ marginTop: 8 }}>
          <details>
            <summary className="label">Compare ROI (dev)</summary>
            <table className="small" style={{ marginTop: 6, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Edge</th><th>Old ROI</th><th>New ROI</th><th>volumeBoost</th><th>partyDrag</th><th>speedToPilotBoost</th>
                </tr>
              </thead>
              <tbody>
                {[...visibleFlows].filter(e => ["adjudicated payments","rebate payments","contract payments","trial data"].some(k => (e.label || "").includes(k))).slice(0,8).map(e => {
                  const oldRoi = (() => {
                    const need = adjustedAssuranceNeed(e);
                    const legal = legalExpenseByAnyEdge(e);
                    const audit = auditPressureByEdge(e);
                    const penalty = integrationPenaltyUSD(e);
                    const base = need * 0.35 + legal * 0.20 + audit * 0.35 - penalty * 0.10;
                    const spd = speedScore(e) * 1_000_000;
                    return base + spd;
                  })();
                  const vb = volumeBoost((e as any).txCount);
                  const pd = partyDrag((e as any).counterpartyCount);
                  const spdB = speedToPilotBoost((e as any).avgCycleDays, (e as any).interopComplexity);
                  const newRoi = (baseRoi(e) * vb * pd) + spdB;
                  return (
                    <tr key={e.id}>
                      <td>{e.label || e.type}</td>
                      <td>{fmt(oldRoi)}</td>
                      <td>{fmt(newRoi)}</td>
                      <td>{vb.toFixed(2)}</td>
                      <td>{pd.toFixed(2)}</td>
                      <td>{fmt(spdB)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <div className="label">Top Speed‑to‑Pilot</div>
        {topSpeed.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <ul className="small" style={{ marginTop: 4 }}>
            {topSpeed.map(({ e, spd }) => (
              <li key={e.id}>
                {actorNameById.get(e.from) || "?"} → {actorNameById.get(e.to) || "?"} — {e.label || e.type} — score {spd.toFixed(3)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">Top $ need</div>
        {topDollarNeed.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
        <ul className="small" style={{ marginTop: 4 }}>
          {topDollarNeed.map(({ e, need, amount }) => (
            <li key={e.id}>
                {e.label || e.type} — {actorNameById.get(e.from) || "?"} → {actorNameById.get(e.to) || "?"} — {fmt(need)}{(amount?.estimated || isEstimate(e)) ? " (est.)" : ""} (amount {fmt((amount?.amountUSD ?? 0) as number)}, TG {e.trustGap ?? 0}, Fric {e.friction ?? 0})
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">Top legal exposure (money flows)</div>
        {topLegalExposure.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <ul className="small" style={{ marginTop: 4 }}>
            {topLegalExposure.map(({ e, cost }) => (
              <li key={e.id}>
                {actorNameById.get(e.from) || "?"} → {actorNameById.get(e.to) || "?"} — {e.label || e.type} — {fmt(cost)}
            </li>
          ))}
        </ul>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label">Top targets (BD focus)</div>
        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn" onClick={copyTopTargets}>Copy targets</button>
        </div>
        {topTargets.length === 0 ? (
          <div className="small" style={{ marginTop: 4, color: "var(--muted)" }}>None in current view</div>
        ) : (
          <ul className="small" style={{ marginTop: 4 }}>
            {topTargets.map(({ e, need, amount }) => {
              const ztlEligibleEdge = (e.trustGap ?? 0) >= 60 && (e.sensitivity ?? 0) >= 60;
              const reason = ztlEligibleEdge ? "High $ + ZTL candidate" : "High $ + friction";
              return (
                <li key={e.id}>
                  {actorNameById.get(e.from) || "?"} → {actorNameById.get(e.to) || "?"} — {e.label || e.type} — {fmt(need)}{(amount?.estimated || isEstimate(e)) ? " (est.)" : ""} ({reason})
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {/* Footnotes */}
      <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
        <div className="small" style={{ color: "var(--muted)", lineHeight: 1.4 }}>
          <div><sup>1</sup> Σ(friction × trustGap × sensitivity) / 10000 across visible flows; unitless signal of operational friction.</div>
          <div><sup>2</sup> Σ(economic value × friction% × trustGap%) across visible flows, adjusted by interop complexity (EDI/FHIR +25%, HL7v2 +15%).</div>
          <div><sup>3</sup> Σ txCount × disputeRate × ((1−litigationRate)×avgDisputeCost + litigationRate×avgLitigationCost).</div>
          <div>Audit Pressure: soft‑capped — cadence × max(findings,1) × avgAuditCost × siteCount, gentle slope beyond $250k, cap at $1.0M; uplift by 15% × violationRate.</div>
          <div>ROI base = 0.35×Preventable Friction + 0.20×Legal Exposure + 0.35×Audit Pressure − 0.10×Integration Penalty. Speed‑to‑Pilot contributes only as a micro tie‑breaker in combined. Normalized by √(economic value).</div>
        </div>
      </div>
    </div>
  );
}


