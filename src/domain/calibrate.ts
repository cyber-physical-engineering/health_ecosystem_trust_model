import type { Actor, Flow } from "@domain/schema";
import { actorNameMap, roiNormalized, topNormalizedRoi, adjustedAssuranceNeed, legalExpenseByEdge, auditPressureByEdge, baseRoi, roiComposite, amountInfo } from "@domain/roi";

export const CRO_CAL_VERSION = "v0.3-synthetic-cro-calibrated";

type BeforeAfterRow = {
  edgeId: string;
  edgeLabel: string;
  txCount: number | undefined;
  auditCadence: string | undefined;
  interopComplexity: string | undefined;
  counterparties: number | undefined;
  economicValueUSD: number | undefined;
  PreventableFrictionUSD: number;
  LegalExposureUSD: number;
  AuditPressureUSD: number;
  ROI_base: number;
  ROI_total: number;
  ROI_normalized: number;
};

function labelMatches(label?: string | null): boolean {
  if (!label) return false;
  const s = String(label).toLowerCase();
  return (s.includes("trial data") || s.includes("sdv") || s.includes("audits"));
}

function isCroPharmaEdge(actors: Actor[], f: Flow): boolean {
  const names = actorNameMap(actors);
  const fromName = names.get(f.from) || "";
  const toName = names.get(f.to) || "";
  const fromType = (actors.find(a => a.id === f.from)?.type as string | undefined) || "";
  const toType = (actors.find(a => a.id === f.to)?.type as string | undefined) || "";
  const a = (fromName + " " + fromType).toLowerCase();
  const b = (toName + " " + toType).toLowerCase();
  const ab = (a.includes("cro") && b.includes("pharmamfg")) || (a.includes("pharmamfg") && b.includes("cro"));
  return ab && labelMatches(f.label);
}

export function calibrateCROPharma(actors: Actor[], flows: Flow[]) {
  const updated: Flow[] = flows.map(f => ({ ...f }));
  for (const f of updated) {
    if (!isCroPharmaEdge(actors, f)) continue;
    (f as any).txCount = 350000;
    (f as any).auditCadence = "quarterly";
    if (f.type === "audit") (f as any).cadence = "quarterly";
    (f as any).interopComplexity = "FHIR";
    (f as any).counterpartyCount = 3;
    (f as any).economicValueUSD = 30000000;
    if (typeof (f as any).friction !== "number") (f as any).friction = 65;
    if (typeof (f as any).trustGap !== "number") (f as any).trustGap = 65;
  }
  return updated;
}

export function beforeAfterRows(actors: Actor[], original: Flow[], calibrated: Flow[]): { before: BeforeAfterRow[]; after: BeforeAfterRow[]; affectedIds: Set<string> } {
  const affectedIds = new Set<string>();
  for (const f of original) {
    if (isCroPharmaEdge(actors, f)) affectedIds.add(f.id);
  }
  const rows = (arr: Flow[]) => arr.filter(f => affectedIds.has(f.id)).map(e => {
    const pf = adjustedAssuranceNeed(e as any);
    const legal = legalExpenseByEdge(e as any);
    const audit = auditPressureByEdge(e as any, arr);
    const base = baseRoi(e as any, arr);
    const total = roiComposite(e as any, arr);
    const roiN = roiNormalized(e as any, arr);
    return {
      edgeId: e.id,
      edgeLabel: e.label || e.type,
      txCount: (e as any).txCount,
      auditCadence: ((e as any).auditCadence ?? (e as any).cadence) as any,
      interopComplexity: (e as any).interopComplexity as any,
      counterparties: (e as any).counterpartyCount as any,
      economicValueUSD: amountInfo(e as any).amountUSD,
      PreventableFrictionUSD: pf,
      LegalExposureUSD: legal,
      AuditPressureUSD: audit,
      ROI_base: base,
      ROI_total: total,
      ROI_normalized: roiN
    } as BeforeAfterRow;
  });
  return { before: rows(original), after: rows(calibrated), affectedIds };
}

export function generateReportMarkdown(actors: Actor[], original: Flow[], calibrated: Flow[], originalDatasetPath: string | null, calibratedPath: string, reportPath: string) {
  const names = actorNameMap(actors);
  const { before, after, affectedIds } = beforeAfterRows(actors, original, calibrated);
  const beforeTop = topNormalizedRoi(original, 10);
  const afterTop = topNormalizedRoi(calibrated, 10);

  const header = [
    "# CRO ↔ PharmaMfg calibration report",
    "",
    "Rationale:",
    "- Align trial data and SDV/audit interfaces with current calibration (volume, cadence, interop).",
    "- Use FHIR multiplier (1.25) to reflect richer clinical data exchange.",
    "- Quarterly audits reflect higher oversight pressure during trials.",
    "- Normalize counterparties to 3 for realistic vendor/regulatory touchpoints.",
    "- Set economic value to midpoint of current range for comparability.",
    "",
  ].join("\n");

  const tableHeader = "| edgeLabel | txCount | auditCadence | interopComplexity | counterparties | economicValueUSD | PreventableFrictionUSD | LegalExposureUSD | AuditPressureUSD | ROI_base | ROI_total | ROI_normalized |\n|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|";

  const fmtRow = (r: BeforeAfterRow) => `| ${r.edgeLabel} | ${r.txCount ?? ''} | ${r.auditCadence ?? ''} | ${r.interopComplexity ?? ''} | ${r.counterparties ?? ''} | ${Math.round(r.economicValueUSD ?? 0)} | ${Math.round(r.PreventableFrictionUSD)} | ${Math.round(r.LegalExposureUSD)} | ${Math.round(r.AuditPressureUSD)} | ${Math.round(r.ROI_base)} | ${Math.round(r.ROI_total)} | ${Math.round(r.ROI_normalized)} |`;

  const paired = before.map(b => ({ b, a: after.find(x => x.edgeId === b.edgeId)! }));
  const beforeAfterTable = [
    "## Affected edges: before vs after",
    tableHeader,
    ...paired.map(({ b, a }) => fmtRow(b)),
    "",
    tableHeader,
    ...paired.map(({ b, a }) => fmtRow(a)),
    "",
  ].join("\n");

  const listTop = (label: string, list: { flow: Flow; roi: number }[]) => [
    `## Top 10 by ROI (normalized) — ${label}`,
    ...list.map(({ flow, roi }, i) => {
      const name = `${names.get(flow.from) || '?'} → ${names.get(flow.to) || '?'} — ${flow.label || flow.type}`;
      const tag = affectedIds.has(flow.id) ? " (CRO calibrated)" : "";
      return `${i + 1}. ${name}: ${roi.toFixed(0)}${tag}`;
    }),
    ""
  ].join("\n");

  const footer = [
    "---",
    "Paths:",
    `- original dataset: ${originalDatasetPath ?? '(in-memory seed)'}\n- calibrated dataset: ${calibratedPath}\n- report: ${reportPath}`,
    "",
    "Before/after ROI (normalized) for calibrated edges:",
    ...paired.map(({ b, a }) => `- ${b.edgeLabel}: ${Math.round(b.ROI_normalized)} → ${Math.round(a.ROI_normalized)}`),
    ""
  ].join("\n");

  return [header, beforeAfterTable, listTop("before", beforeTop), listTop("after", afterTop), footer].join("\n");
}


