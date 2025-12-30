import { FEATURE_NEW_ROI_MATH, SESSION_DEFAULT_NARRATIVE } from "@domain/flags";
import { interopFactor, cadenceFactor as cadenceFactorV2, clamp as clampV2, volumeBoost, partyDrag, speedToPilotBoost } from "@domain/math";
import type { Actor, Flow } from "@domain/schema";

type AmountInfo = { amountUSD: number; estimated: boolean };

export function narrativeToScore(v?: string): number {
  const n = (v ?? SESSION_DEFAULT_NARRATIVE).toLowerCase();
  if (n === "innovation") return 0.95;
  if (n === "proof") return 0.80;
  if (n === "compliance") return 0.70;
  if (n === "cost") return 0.60;
  return 0.58; // neutral/default
}

export function amountInfo(e: any): AmountInfo {
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
  if (typeof units === "number" && typeof unitVal === "number") {
    return { amountUSD: units * unitVal, estimated: true };
  }
  return { amountUSD: 0, estimated: false };
}

export function interopMultiplier(e: any): number {
  return interopFactor((e?.interopComplexity as string | undefined) || "JSON");
}

export function baseAssuranceNeed(e: any): number {
  const { amountUSD } = amountInfo(e);
  const f = (e?.friction ?? 0) / 100;
  const t = (e?.trustGap ?? 0) / 100;
  return amountUSD * f * t;
}

export function adjustedAssuranceNeed(e: any): number {
  return baseAssuranceNeed(e) * interopMultiplier(e);
}

export function integrationPenaltyUSD(e: any): number {
  const base = baseAssuranceNeed(e);
  const mult = interopMultiplier(e);
  return base * Math.max(0, mult - 1);
}

export function legalExpenseByEdge(e: any): number {
  if (e?.type !== "money") return 0;
  const tx = ((e as any).txCount ?? null) as number | null;
  const dispute = ((e as any).disputeRatePct ?? 0) / 100;
  const litig = ((e as any).litigationRatePct ?? 0) / 100;
  const cDispute = ((e as any).avgDisputeCostUSD ?? 0) as number;
  const cLit = ((e as any).avgLitigationCostUSD ?? 0) as number;
  if (!tx) return 0;
  const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
  return tx * expectedCostPerTx;
}

export function auditPressureForAuditEdge(e: any): number {
  const findings = Math.max(1, (e?.findingsOpen ?? 1) as number);
  const avg = Math.max(0, (e?.avgAuditCostUSD ?? 50000) as number);
  const cad = ((e?.auditCadence as string | undefined) ?? (e?.cadence as string | undefined));
  const sites = Math.max(1, (e?.siteCount ?? 1) as number);
  const vio = Math.max(0, Math.min(1, (e?.violationRate ?? 0.0) as number));
  const factor = cadenceFactorV2(cad);

  const rawAudit = factor * findings * avg * sites;
  const capLow = 250000, capHigh = 1000000, softness = 0.25;
  const softPart = Math.max(0, rawAudit - capLow);
  let pressure = Math.min(rawAudit, capHigh) - softness * softPart;
  pressure = Math.max(0, pressure);
  pressure *= (1 + 0.15 * vio);
  return clampV2(pressure, 25000, 1000000);
}

export function strategicFitOf(e: any): number {
  const a = typeof e?.accessFactor === "number" ? e.accessFactor : 1.0;
  const r = typeof e?.referenceabilityFactor === "number" ? e.referenceabilityFactor : 1.0;
  const v = typeof e?.verticalFitFactor === "number" ? e.verticalFitFactor : 1.0;
  const raw = a * r * v;
  return clampV2(raw, 0.8, 1.2);
}

export function auditPressureByEdge(e: any, allFlows: Flow[]): number {
  let total = 0;
  if ((e as any)?.type === "audit") total += auditPressureForAuditEdge(e);
  const lid = ((e as any)?.linkedFlowId as string | undefined) || null;
  for (const f of allFlows) {
    if (f.type !== "audit") continue;
    const fl = (f as any).linkedFlowId as string | undefined;
    if (f.id === (e as any).id || f.id === lid || (fl && (fl === (e as any).id || fl === lid))) {
      total += auditPressureForAuditEdge(f);
    }
  }
  return total;
}

export function baseRoi(e: any, allFlows: Flow[]): number {
  const need = adjustedAssuranceNeed(e);
  const legal = legalExpenseByEdge(e);
  const audit = auditPressureByEdge(e, allFlows);
  const penalty = integrationPenaltyUSD(e);
  const regW = Number.isFinite((e?.regExposureWeight as any)) ? (e.regExposureWeight as number) : 1.0;
  if (FEATURE_NEW_ROI_MATH) {
    return need * 0.35 * regW + legal * 0.20 + audit * 0.35 - penalty * 0.10;
  }
  return need * 0.35 + legal * 0.20 + audit * 0.35 - penalty * 0.10;
}

export function roiComposite(e: any, allFlows: Flow[]): number {
  if (FEATURE_NEW_ROI_MATH) {
    const base = baseRoi(e, allFlows);
    const vb = volumeBoost((e as any).txCount);
    const pd = partyDrag((e as any).counterpartyCount);
    return (base * vb * pd);
  }
  return baseRoi(e, allFlows);
}

export function roiNormalized(e: any, allFlows: Flow[]): number {
  const { amountUSD } = amountInfo(e);
  const denom = Math.sqrt(Math.max(1, (amountUSD ?? 0)));
  return roiComposite(e, allFlows) / denom;
}

export function ztlEligible(flows: Flow[]): Flow[] {
  return flows.filter(fl => (fl.trustGap ?? 0) >= 60 && (fl.sensitivity ?? 0) >= 60);
}

export function topNormalizedRoi(flows: Flow[], n: number): { flow: Flow; roi: number }[] {
  return [...flows]
    .map(e => ({ flow: e, roi: roiNormalized(e as any, flows) }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, n);
}

export function actorNameMap(actors: Actor[]): Map<string, string> {
  return new Map(actors.map(a => [a.id, a.name] as const));
}


