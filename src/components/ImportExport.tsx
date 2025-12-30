import { saveAs } from "file-saver";
import { useRef, useState } from "react";
import { useStore } from "@state/store";
import { STORAGE_KEY } from "@domain/schema";
import { FEATURE_NEW_ROI_MATH } from "@domain/flags";
import { interopFactor, cadenceFactor as cadenceFactorV2, clamp as clampV2, volumeBoost, partyDrag, speedToPilotBoost, speedToPilotScore01 } from "@domain/math";
import { calibrateCROPharma, CRO_CAL_VERSION, generateReportMarkdown } from "@domain/calibrate";
import { narrativeToScore } from "@domain/roi";
import { strategicFitOf } from "@domain/roi";

export function ImportExport() {
  const saveToLocal = useStore(s => s.saveToLocal);
  const importModel = useStore(s => s.importModel);
  const resetToSeed = useStore(s => s.resetToSeed);
  const actors = useStore(s => s.actors);
  const flows = useStore(s => s.flows);
  const cy = useStore(s => (s as any).cy) as any;
  const filters = useStore(s => s.filters);
  const scenario = useStore(s => s.scenario);
  const visibleFlows = useStore(s => s.visibleFlows)();
  const repairModel = useStore(s => (s as any).repairModel) as () => void;
  const rebuildArrows = useStore(s => (s as any).rebuildArrows) as () => void;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const estimateDataDollarToggle = useStore(s => (s as any).estimateDataDollarToggle as boolean);
  const updateFlow = useStore(s => s.updateFlow);
  const [autoTagPreview, setAutoTagPreview] = useState<null | { id: string; from: string; to: string; label: string; propose: "proof"|"innovation"|"compliance"|"cost" }[]>(null);
  const narrativeScore = (e: any) => {
    return narrativeToScore((e?.narrativeValue as string | undefined));
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify({ actors, flows }, null, 2)], { type: "application/json;charset=utf-8" });
    saveAs(blob, "health-ecosys-model.json");
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      const res = importModel(json);
      if (res.ok) setErrors(null);
      else setErrors(res.errors);
    } catch (e: any) {
      setErrors([`Invalid JSON: ${e?.message ?? e}`]);
    }
  };

  const onExportPng = () => {
    try {
      if (!cy) return;
      const uri: string = cy.png({ scale: 2, full: false });
      // Convert data URL to Blob
      const arr = uri.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });
      saveAs(blob, "health-trust-graph.png");
    } catch {}
  };

  const onExportSvg = () => {
    try {
      if (!cy?.svg) return;
      const svgText: string = cy.svg({ scale: 1, full: false });
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      saveAs(blob, "health-trust-graph.svg");
    } catch {}
  };

  const onExportSummary = () => {
    try {
      const money = visibleFlows.filter(e => e.type === "money");
      const assuranceNeed = (e: any) => {
        const base = (e.dollarValue ?? e.volume ?? 0) as number;
        const f = (e.friction ?? 0) / 100;
        const t = (e.trustGap ?? 0) / 100;
        return base * f * t;
      };
      const legalExpense = (e: any) => {
        const tx = (e.txCount ?? null) as number | null;
        const dispute = (e.disputeRatePct ?? 0) / 100;
        const litig = (e.litigationRatePct ?? 0) / 100;
        const cDispute = (e.avgDisputeCostUSD ?? 0) as number;
        const cLit = (e.avgLitigationCostUSD ?? 0) as number;
        if (!tx) return 0;
        const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
        return tx * expectedCostPerTx;
      };
      const totalAssuranceNeed = money.reduce((s, e) => s + assuranceNeed(e), 0);
      const totalLegalExposure = money.reduce((s, e) => s + legalExpense(e), 0);
      const disputeRisk = visibleFlows.reduce((sum, e) => {
        const f = e.friction ?? 0, t = e.trustGap ?? 0, s = e.sensitivity ?? 0;
        return sum + (f * t * s) / 10000;
      }, 0);
      const actorNameById = Object.fromEntries(actors.map(a => [a.id, a.name]));
      const topTargets = money
        .map(e => ({ e, need: assuranceNeed(e) }))
        .sort((a, b) => b.need - a.need)
        .slice(0, 5)
        .map(({ e, need }) => ({
          from: actorNameById[(e as any).from] || (e as any).from,
          to: actorNameById[(e as any).to] || (e as any).to,
          label: e.label || e.type,
          need,
          trustGap: e.trustGap,
          friction: e.friction,
          dollarValue: (e as any).dollarValue
        }));
      const topLegal = money
        .map(e => ({ e, cost: legalExpense(e) }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
        .map(({ e, cost }) => ({
          from: actorNameById[(e as any).from] || (e as any).from,
          to: actorNameById[(e as any).to] || (e as any).to,
          label: e.label || e.type,
          cost,
          txCount: (e as any).txCount,
          disputeRatePct: (e as any).disputeRatePct,
          litigationRatePct: (e as any).litigationRatePct
        }));

      const summary = {
        generatedAt: new Date().toISOString(),
        scenario,
        filters,
        metrics: {
          disputeRisk,
          totalAssuranceNeed,
          totalLegalExposure,
          topTargets,
          topLegal
        }
      };
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json;charset=utf-8" });
      saveAs(blob, "health-trust-summary.json");
    } catch {}
  };

  // Auto-tag narrative (safe) — idempotent, only when unset, with preview, capped per class
  const buildAutoTagPreview = () => {
    try {
      const idToName = new Map(actors.map(a => [a.id, a.name] as const));
      const lowerIncludes = (s: string, re: RegExp) => re.test((s || "").toLowerCase());
      const suggestions: { id: string; from: string; to: string; label: string; propose: any }[] = [];
      const caps = { proof: 3, innovation: 3, compliance: 3, cost: 3 } as Record<string, number>;
      const used = { proof: 0, innovation: 0, compliance: 0, cost: 0 } as Record<string, number>;
      for (const f of flows) {
        const has = (f as any).narrativeValue as (string | undefined);
        if (has) continue; // only unset
        const label = (f.label || f.type || "") as string;
        const pairs: [RegExp, any][] = [
          [/audit|inspection|clia|gmp|sdv/i, "compliance"],
          [/trial|udi|telemetry|interfaces|upgrades|firmware/i, "innovation"],
          [/payments|reimbursements|rebate|adjudicated|copays/i, "cost"],
          [/claims|results|orders|reports|specs|batch/i, "proof"]
        ];
        let propose: any = null;
        for (const [re, val] of pairs) { if (lowerIncludes(label, re)) { propose = val; break; } }
        if (propose && used[propose] < caps[propose]) {
          suggestions.push({ id: f.id, from: idToName.get(f.from) || "?", to: idToName.get(f.to) || "?", label, propose });
          used[propose] += 1;
        }
      }
      setAutoTagPreview(suggestions);
    } catch {}
  };
  const applyAutoTags = () => {
    try {
      const ids = new Set(autoTagPreview?.map(s => s.id) || []);
      for (const f of flows) {
        if (!ids.has(f.id)) continue;
        const proposed = autoTagPreview?.find(s => s.id === f.id)?.propose as any;
        const has = (f as any).narrativeValue as (string | undefined);
        if (!has && proposed) updateFlow(f.id, { narrativeValue: proposed });
      }
      // summary after apply
      const counts = { proof: 0, innovation: 0, compliance: 0, cost: 0, unset: 0 } as Record<string, number>;
      let sum = 0;
      for (const f of flows) {
        const v = (f as any).narrativeValue as (keyof typeof counts | undefined);
        if (v && v in counts) counts[v]++; else counts.unset++;
        sum += narrativeToScore(v as any);
      }
      const avg = flows.length ? (sum / flows.length) : 0;
      try { console.log("Narrative tags summary", { counts, avgNarrativeScore: Number(avg.toFixed(3)) }); } catch {}
      const untagged = flows.filter(f => !(f as any).narrativeValue).map(f => (f.label || f.type));
      if (untagged.length > 0) {
        try { console.log("Remaining flows without narrative tags (manual):", untagged.slice(0, 20), `(+${Math.max(0, untagged.length - 20)} more)`); } catch {}
      }
      // refresh preview to show remaining (should be none if all applied)
      buildAutoTagPreview();
    } catch {}
  };

  const onExportRoiDataset = () => {
    try {
      const actorNameById = new Map(actors.map(a => [a.id, a.name] as const));
      const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
      const interopMultiplier = (e: any) => interopFactor((e?.interopComplexity as string | undefined) || "JSON");
      const amountInfo = (e: any) => {
        const explicit = (e?.economicValueUSD as number | undefined);
        if (typeof explicit === "number" && !Number.isNaN(explicit)) {
          const scale = (e?.marketScale as string | undefined);
          const factor = scale === "high" ? 20 : scale === "medium" ? 5 : 1;
          return { amountUSD: explicit * factor };
        }
        const dollar = (e?.dollarValue as number | undefined);
        if (typeof dollar === "number" && !Number.isNaN(dollar)) return { amountUSD: dollar };
        const units = (e?.unitCount as number | undefined);
        const unitVal = (e?.unitValueUSD as number | undefined);
        if (estimateDataDollarToggle && typeof units === "number" && typeof unitVal === "number") return { amountUSD: units * unitVal };
        return { amountUSD: 0 };
      };
      const baseAssuranceNeed = (e: any) => {
        const { amountUSD } = amountInfo(e);
        const f = (e?.friction ?? 0) / 100;
        const t = (e?.trustGap ?? 0) / 100;
        return amountUSD * f * t;
      };
      const adjustedAssuranceNeed = (e: any) => baseAssuranceNeed(e) * interopMultiplier(e);
      const integrationPenaltyUSD = (e: any) => baseAssuranceNeed(e) * Math.max(0, interopMultiplier(e) - 1);
      const legalExpenseByEdge = (e: any) => {
        if (e?.type !== "money") return 0;
        const tx = (e?.txCount ?? null) as number | null;
        const dispute = (e?.disputeRatePct ?? 0) / 100;
        const litig = (e?.litigationRatePct ?? 0) / 100;
        const cDispute = (e?.avgDisputeCostUSD ?? 0) as number;
        const cLit = (e?.avgLitigationCostUSD ?? 0) as number;
        if (!tx) return 0;
        const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
        return tx * expectedCostPerTx;
      };
      const cadenceFactorLegacy = (cad: string | undefined) => cad === "quarterly" ? 4 : 1;
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
        let total = 0;
        if (e?.type === "audit") total += auditPressureForAuditEdge(e);
        const lid = (e?.linkedFlowId as string | undefined) || null;
        for (const f of visibleFlows) {
          if (f.type !== "audit") continue;
          const fl = (f as any).linkedFlowId as string | undefined;
          if (f.id === e.id || f.id === lid || (fl && (fl === e.id || fl === lid))) total += auditPressureForAuditEdge(f);
        }
        return total;
      };
      const counterpartiesFor = (e: any) => {
        const lid = (e?.linkedFlowId as string | undefined) || null;
        const hasAudit = visibleFlows.some(f => f.type === "audit" && ((f as any).linkedFlowId === e.id || (f as any).linkedFlowId === lid || f.id === e.id || f.id === lid));
        return 2 + (hasAudit ? 1 : 0);
      };
      const speedScore = (e: any) => 1 / (interopMultiplier(e) * counterpartiesFor(e));
      const baseRoi = (e: any) => {
        const need = adjustedAssuranceNeed(e);
        const legal = legalExpenseByEdge(e);
        const audit = auditPressureByEdge(e);
        const penalty = integrationPenaltyUSD(e);
        const regW = Number.isFinite((e?.regExposureWeight as any)) ? (e.regExposureWeight as number) : 1.0;
        if (FEATURE_NEW_ROI_MATH) return need * 0.35 * regW + legal * 0.20 + audit * 0.35 - penalty * 0.10;
        return need * 0.35 + legal * 0.20 + audit * 0.35 - penalty * 0.10;
      };
      const roiComposite = (e: any) => {
        if (FEATURE_NEW_ROI_MATH) {
          const vb = volumeBoost((e as any).txCount);
          const pd = partyDrag((e as any).counterpartyCount);
          return (baseRoi(e) * vb * pd);
        }
        return baseRoi(e);
      };
      const roiNormalized = (e: any) => {
        const { amountUSD } = amountInfo(e);
        const denom = Math.sqrt(Math.max(1, (amountUSD ?? 0)));
        return roiComposite(e) / denom;
      };

      const rows = visibleFlows.map((e: any) => {
        const { amountUSD } = amountInfo(e);
        const pf = adjustedAssuranceNeed(e);
        const legal = legalExpenseByEdge(e);
        const audit = auditPressureByEdge(e);
        const penalty = integrationPenaltyUSD(e);
        const parties = counterpartiesFor(e);
        const interop = interopMultiplier(e);
        const roi = roiComposite(e);
        const roiN = roiNormalized(e);
        const vb = volumeBoost((e as any).txCount);
        const pd = partyDrag((e as any).counterpartyCount);
        const spdBoost = speedToPilotBoost((e as any).avgCycleDays, (e as any).interopComplexity);
        return {
          source: actorNameById.get(e.from) || "?",
          target: actorNameById.get(e.to) || "?",
          flow_type: e.type,
          economic_value_usd: Number(amountUSD ?? 0),
          friction_pct: Number(e.friction ?? 0),
          trust_gap_pct: Number(e.trustGap ?? 0),
          sensitivity: Number(e.sensitivity ?? 0),
          preventable_friction_usd: Number(pf),
          legal_exposure_usd: Number(legal),
          audit_pressure_usd: Number(audit),
          integration_penalty_usd: Number(penalty),
          counterparties: Number(parties),
          interop_factor: Number(interop),
          roi_composite: Number(roi),
          roi_normalized: Number(roiN),
          speed_to_pilot_score: Number(speedScore(e)),
          volumeBoost: FEATURE_NEW_ROI_MATH ? Number(vb) : undefined,
          partyDrag: FEATURE_NEW_ROI_MATH ? Number(pd) : undefined,
          speedToPilotBoost: FEATURE_NEW_ROI_MATH ? Number(spdBoost) : undefined,
          narrative_value: (e as any).narrativeValue ?? null,
          narrative_score: Number(narrativeScore(e)),
          market_scale: (e as any).marketScale ?? null
        };
      });
      const top15 = rows.sort((a, b) => b.roi_normalized - a.roi_normalized).slice(0, 15);
      const blob = new Blob([JSON.stringify(top15, null, 2)], { type: "application/json;charset=utf-8" });
      saveAs(blob, "roi_normalized_dataset.json");
    } catch {}
  };

  const onExportTop10RoiNarrative = () => {
    try {
      const actorNameById = new Map(actors.map(a => [a.id, a.name] as const));
      const interopMultiplier = (e: any) => interopFactor((e?.interopComplexity as string | undefined) || "JSON");
      const amountInfo = (e: any) => {
        const explicit = (e?.economicValueUSD as number | undefined);
        if (typeof explicit === "number" && !Number.isNaN(explicit)) {
          const scale = (e?.marketScale as string | undefined);
          const factor = scale === "high" ? 20 : scale === "medium" ? 5 : 1;
          return { amountUSD: explicit * factor };
        }
        const dollar = (e?.dollarValue as number | undefined);
        if (typeof dollar === "number" && !Number.isNaN(dollar)) return { amountUSD: dollar };
        const units = (e?.unitCount as number | undefined);
        const unitVal = (e?.unitValueUSD as number | undefined);
        if (estimateDataDollarToggle && typeof units === "number" && typeof unitVal === "number") return { amountUSD: units * unitVal };
        return { amountUSD: 0 };
      };
      const baseAssuranceNeed = (e: any) => {
        const { amountUSD } = amountInfo(e);
        const f = (e?.friction ?? 0) / 100;
        const t = (e?.trustGap ?? 0) / 100;
        return amountUSD * f * t;
      };
      const adjustedAssuranceNeed = (e: any) => baseAssuranceNeed(e) * interopMultiplier(e);
      const integrationPenaltyUSD = (e: any) => baseAssuranceNeed(e) * Math.max(0, interopMultiplier(e) - 1);
      const legalExpenseByEdge = (e: any) => {
        if (e?.type !== "money") return 0;
        const tx = (e?.txCount ?? null) as number | null;
        const dispute = (e?.disputeRatePct ?? 0) / 100;
        const litig = (e?.litigationRatePct ?? 0) / 100;
        const cDispute = (e?.avgDisputeCostUSD ?? 0) as number;
        const cLit = (e?.avgLitigationCostUSD ?? 0) as number;
        if (!tx) return 0;
        const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
        return tx * expectedCostPerTx;
      };
      const auditPressureForAuditEdge = (e: any) => {
        const findings = (e?.findingsOpen ?? 1) as number;
        const avg = (e?.avgAuditCostUSD ?? 50000) as number;
        const cad = ((e?.auditCadence as string | undefined) ?? (e?.cadence as string | undefined));
        if (FEATURE_NEW_ROI_MATH) {
          const factor = cadenceFactorV2(cad);
          const total = Math.max(0, findings) * factor * Math.max(0, avg);
          return clampV2(total, 25000, 100000);
        } else {
          const cost = Math.max(25000, Math.min(100000, avg));
          const factor = cad === "quarterly" ? 4 : 1;
          return Math.max(0, findings) * factor * cost;
        }
      };
      const auditPressureByEdge = (e: any) => {
        let total = 0;
        if (e?.type === "audit") total += auditPressureForAuditEdge(e);
        const lid = (e?.linkedFlowId as string | undefined) || null;
        for (const f of visibleFlows) {
          if (f.type !== "audit") continue;
          const fl = (f as any).linkedFlowId as string | undefined;
          if (f.id === e.id || f.id === lid || (fl && (fl === e.id || fl === lid))) total += auditPressureForAuditEdge(f);
        }
        return total;
      };
      const baseRoi = (e: any) => {
        const need = adjustedAssuranceNeed(e);
        const legal = legalExpenseByEdge(e);
        const audit = auditPressureByEdge(e);
        const penalty = integrationPenaltyUSD(e);
        const regW = Number.isFinite((e?.regExposureWeight as any)) ? (e.regExposureWeight as number) : 1.0;
        if (FEATURE_NEW_ROI_MATH) return need * 0.35 * regW + legal * 0.20 + audit * 0.35 - penalty * 0.10;
        return need * 0.35 + legal * 0.20 + audit * 0.35 - penalty * 0.10;
      };
      const speedScore = (e: any) => 1 / (interopMultiplier(e) * (2 + (visibleFlows.some(f => f.type === "audit" && ((f as any).linkedFlowId === e.id || (f as any).linkedFlowId === (e as any).linkedFlowId || f.id === e.id || f.id === (e as any).linkedFlowId)) ? 1 : 0)));
      const roiComposite = (e: any) => {
        if (FEATURE_NEW_ROI_MATH) {
          const vb = volumeBoost((e as any).txCount);
          const pd = partyDrag((e as any).counterpartyCount);
          return (baseRoi(e) * vb * pd);
        }
        return baseRoi(e);
      };
      const roiNormalized = (e: any) => {
        const { amountUSD } = amountInfo(e);
        const denom = Math.sqrt(Math.max(1, (amountUSD ?? 0)));
        return roiComposite(e) / denom;
      };

      const allRows = visibleFlows.map((e: any) => {
        const roiN = roiNormalized(e);
        const nScore = narrativeScore(e);
        const sf = strategicFitOf(e);
        const sp = speedToPilotScore01((e as any).avgCycleDays, (e as any).interopComplexity, (e as any).counterpartyCount);
        const isAudit = e.type === "audit";
        const sc = (e as any).siteCount ?? 1;
        const fnd = (e as any).findingsOpen ?? 0;
        const auditGuard = isAudit && (sc < 3 || fnd < 3) ? 0.90 : 1.00;
        return {
          source: actorNameById.get(e.from) || "?",
          target: actorNameById.get(e.to) || "?",
          label: e.label || e.type,
          type: e.type,
          narrativeValue: (e as any).narrativeValue ?? null,
          narrativeScore: Number(nScore),
          strategicFit: Number(sf),
          roi_normalized: Number(roiN),
          speed_to_pilot_01: Number(sp),
          combined: Number((roiN * (nScore * 1.10) * (sf * 1.05) + 0.02 * sp) * auditGuard)
        };
      });

      const rows = [...allRows].sort((a, b) => b.combined - a.combined).slice(0, 10);

      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
      saveAs(blob, "roi_narrative_top10.json");
      try { console.table(rows.map(({ source, target, label, roi_normalized, narrativeScore, combined }) => ({ source, target, label, roi_normalized, narrativeScore, combined }))); } catch {}

      // One-line summaries for target wedges
      const want = [
        { source: "PharmaMfg", target: "CMO", label: "GMP audits" },
        { source: "Payer", target: "Provider", label: "post-payment audits" },
        { source: "PharmaMfg", target: "CRO", label: "SDV & audits" },
        { source: "Regulator", target: "PharmaMfg", label: "FDA cGMP inspections" },
        { source: "Provider", target: "Payer", label: "claims & clinical" }
      ];
      for (const w of want) {
        const r = allRows.find(x => x.source === w.source && x.target === w.target && x.label === w.label);
        if (r) {
          try { console.log(`[${w.source}→${w.target} — ${w.label}] ROI_norm=${Math.round(r.roi_normalized)} combined=${r.combined.toFixed(3)} speed=${r.speed_to_pilot_01.toFixed(2)} strategicFit=${r.strategicFit.toFixed(2)}`); } catch {}
        } else {
          try { console.log(`[${w.source}→${w.target} — ${w.label}] not found in dataset`); } catch {}
        }
      }
    } catch {}
  };

  const onExportNarrativeChartAndAnalysis = () => {
    try {
      const actorNameById = new Map(actors.map(a => [a.id, a.name] as const));
      const interopMultiplier = (e: any) => interopFactor((e?.interopComplexity as string | undefined) || "JSON");
      const amountInfo = (e: any) => {
        const explicit = (e?.economicValueUSD as number | undefined);
        if (typeof explicit === "number" && !Number.isNaN(explicit)) {
          const scale = (e?.marketScale as string | undefined);
          const factor = scale === "high" ? 20 : scale === "medium" ? 5 : 1;
          return { amountUSD: explicit * factor };
        }
        const dollar = (e?.dollarValue as number | undefined);
        if (typeof dollar === "number" && !Number.isNaN(dollar)) return { amountUSD: dollar };
        const units = (e?.unitCount as number | undefined);
        const unitVal = (e?.unitValueUSD as number | undefined);
        if (estimateDataDollarToggle && typeof units === "number" && typeof unitVal === "number") return { amountUSD: units * unitVal };
        return { amountUSD: 0 };
      };
      const baseAssuranceNeed = (e: any) => {
        const { amountUSD } = amountInfo(e);
        const f = (e?.friction ?? 0) / 100;
        const t = (e?.trustGap ?? 0) / 100;
        return amountUSD * f * t;
      };
      const adjustedAssuranceNeed = (e: any) => baseAssuranceNeed(e) * interopMultiplier(e);
      const integrationPenaltyUSD = (e: any) => baseAssuranceNeed(e) * Math.max(0, interopMultiplier(e) - 1);
      const legalExpenseByEdge = (e: any) => {
        if (e?.type !== "money") return 0;
        const tx = (e?.txCount ?? null) as number | null;
        const dispute = (e?.disputeRatePct ?? 0) / 100;
        const litig = (e?.litigationRatePct ?? 0) / 100;
        const cDispute = (e?.avgDisputeCostUSD ?? 0) as number;
        const cLit = (e?.avgLitigationCostUSD ?? 0) as number;
        if (!tx) return 0;
        const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
        return tx * expectedCostPerTx;
      };
      const auditPressureForAuditEdge = (e: any) => {
        const findings = (e?.findingsOpen ?? 1) as number;
        const avg = (e?.avgAuditCostUSD ?? 50000) as number;
        const cad = ((e?.auditCadence as string | undefined) ?? (e?.cadence as string | undefined));
        if (FEATURE_NEW_ROI_MATH) {
          const factor = cadenceFactorV2(cad);
          const total = Math.max(0, findings) * factor * Math.max(0, avg);
          return clampV2(total, 25000, 100000);
        } else {
          const cost = Math.max(25000, Math.min(100000, avg));
          const factor = cad === "quarterly" ? 4 : 1;
          return Math.max(0, findings) * factor * cost;
        }
      };
      const auditPressureByEdge = (e: any) => {
        let total = 0;
        if (e?.type === "audit") total += auditPressureForAuditEdge(e);
        const lid = (e?.linkedFlowId as string | undefined) || null;
        for (const f of visibleFlows) {
          if (f.type !== "audit") continue;
          const fl = (f as any).linkedFlowId as string | undefined;
          if (f.id === e.id || f.id === lid || (fl && (fl === e.id || fl === lid))) total += auditPressureForAuditEdge(f);
        }
        return total;
      };
      const baseRoi = (e: any) => {
        const need = adjustedAssuranceNeed(e);
        const legal = legalExpenseByEdge(e);
        const audit = auditPressureByEdge(e);
        const penalty = integrationPenaltyUSD(e);
        const regW = Number.isFinite((e?.regExposureWeight as any)) ? (e.regExposureWeight as number) : 1.0;
        if (FEATURE_NEW_ROI_MATH) return need * 0.35 * regW + legal * 0.20 + audit * 0.35 - penalty * 0.10;
        return need * 0.35 + legal * 0.20 + audit * 0.35 - penalty * 0.10;
      };
      const speedScore = (e: any) => 1 / (interopMultiplier(e) * (2 + (visibleFlows.some(f => f.type === "audit" && ((f as any).linkedFlowId === e.id || (f as any).linkedFlowId === (e as any).linkedFlowId || f.id === e.id || f.id === (e as any).linkedFlowId)) ? 1 : 0)));
      const roiComposite = (e: any) => FEATURE_NEW_ROI_MATH ? (() => {
        const vb = volumeBoost((e as any).txCount);
        const pd = partyDrag((e as any).counterpartyCount);
        return (baseRoi(e) * vb * pd);
      })() : baseRoi(e);
      const roiNormalized = (e: any) => {
        const { amountUSD } = amountInfo(e);
        const denom = Math.sqrt(Math.max(1, (amountUSD ?? 0)));
        return roiComposite(e) / denom;
      };

      const dataset = visibleFlows.map((e: any) => {
        const roiN = roiNormalized(e);
        const nScore = narrativeScore(e);
        const sf = strategicFitOf(e);
        const sp = speedToPilotScore01((e as any).avgCycleDays, (e as any).interopComplexity, (e as any).counterpartyCount);
        const isAudit = e.type === "audit";
        const sc = (e as any).siteCount ?? 1;
        const fnd = (e as any).findingsOpen ?? 0;
        const auditGuard = isAudit && (sc < 3 || fnd < 3) ? 0.90 : 1.00;
        return {
          source: actorNameById.get(e.from) || "?",
          target: actorNameById.get(e.to) || "?",
          label: e.label || e.type,
          flow_type: e.type,
          economic_value_usd: Number(amountInfo(e).amountUSD ?? 0),
          friction_pct: Number(e.friction ?? 0),
          trust_gap_pct: Number(e.trustGap ?? 0),
          narrative_value: (e as any).narrativeValue ?? null,
          narrative_score: Number(nScore),
          strategic_fit: Number(sf),
          roi_normalized: Number(roiN),
          speed_to_pilot_01: Number(sp),
          combined: Number((roiN * (nScore * 1.10) * (sf * 1.05) + 0.02 * sp) * auditGuard)
        };
      });

      const top10 = [...dataset].sort((a, b) => b.combined - a.combined).slice(0, 10);

      // Build SVG scatter (same sizing as Metrics)
      const width = 720, height = 420, padL = 50, padB = 36, padT = 14, padR = 12;
      const innerW = width - padL - padR, innerH = height - padT - padB;
      const maxX = dataset.reduce((m, d) => Math.max(m, d.roi_normalized), 1);
      const sx = (x: number) => padL + (innerW * x) / Math.max(1, maxX);
      const sy = (y: number) => padT + innerH - (innerH * y) / 1.0;
      const color = (v?: string | null) => v === "proof" ? "#10b981" : v === "innovation" ? "#60a5fa" : v === "compliance" ? "#f59e0b" : v === "cost" ? "#ef4444" : "#9ca3af";
      const ticksX = 6;
      const ticks = Array.from({ length: ticksX + 1 }, (_, i) => (maxX * i) / ticksX);
      const points = dataset.map(d => `<g><circle cx="${sx(d.roi_normalized)}" cy="${sy(d.narrative_score)}" r="3" fill="${color(d.narrative_value)}" /><text x="${sx(d.roi_normalized) + 6}" y="${sy(d.narrative_score) - 4}" font-size="10" fill="#a3a3a3">${d.label}</text></g>`).join("");
      const gridX = ticks.map(t => `<g><line x1="${sx(t)}" y1="${padT}" x2="${sx(t)}" y2="${padT + innerH}" stroke="rgba(255,255,255,0.08)" /><text x="${sx(t)}" y="${padT + innerH + 16}" font-size="11" text-anchor="middle" fill="#9ca3af">${Math.round(t)}</text></g>`).join("");
      const gridY = [0,0.5,1.0].map(t => `<g><line x1="${padL}" y1="${sy(t)}" x2="${padL + innerW}" y2="${sy(t)}" stroke="rgba(255,255,255,0.08)" /><text x="${padL - 8}" y="${sy(t)+4}" font-size="11" text-anchor="end" fill="#9ca3af">${t.toFixed(1)}</text></g>`).join("");
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${padL}" y="${padT}" width="${innerW}" height="${innerH}" fill="none" stroke="rgba(255,255,255,0.15)"/>${gridX}${gridY}<text x="${padL + innerW/2}" y="${height - 6}" font-size="12" text-anchor="middle" fill="#9ca3af">ROI_normalized</text><text x="12" y="${padT + 12}" font-size="12" fill="#9ca3af">narrativeScore</text>${points}</svg>`;

      const blobSvg = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      saveAs(blobSvg, "roi_narrative_chart.svg");

      const out = { generatedAt: new Date().toISOString(), top10, dataset: dataset.slice(0, 50) };
      const blobJson = new Blob([JSON.stringify(out, null, 2)], { type: "application/json;charset=utf-8" });
      saveAs(blobJson, "analysis_output.json");

      try { console.table(top10.map(({ source, target, label, roi_normalized, narrative_score, combined }) => ({ source, target, label, roi_normalized, narrative_score, combined }))); } catch {}
    } catch {}
  };

  const onExportCroCalibration = () => {
    try {
      const originalActors = actors;
      const originalFlows = flows;
      const calibratedFlows = calibrateCROPharma(originalActors as any, originalFlows as any);

      const calibratedRoot = {
        datasetVersion: CRO_CAL_VERSION,
        actors: originalActors,
        flows: calibratedFlows
      };

      const calibratedJsonName = "devlog/seed-cro-calibrated.json";
      const reportPath = "devlog/cro_calibration_report.md";

      const reportMd = generateReportMarkdown(
        originalActors as any,
        originalFlows as any,
        calibratedFlows as any,
        null,
        calibratedJsonName,
        reportPath
      );

      const blobJson = new Blob([JSON.stringify(calibratedRoot, null, 2)], { type: "application/json;charset=utf-8" });
      saveAs(blobJson, calibratedJsonName);

      const blobMd = new Blob([reportMd], { type: "text/markdown;charset=utf-8" });
      saveAs(blobMd, reportPath);
    } catch {}
  };

  return (
    <div className="panel">
      <div className="row">
        <button className="btn primary" onClick={saveToLocal}>Save to localStorage</button>
        <button className="btn" onClick={onExport}>Export JSON</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
        <button className="btn" onClick={onExportPng} disabled={!cy}>Export PNG</button>
        <button className="btn" onClick={onExportSvg} disabled={!cy}>Export SVG</button>
        <button className="btn" onClick={onExportSummary}>Export Summary JSON</button>
        <button className="btn" onClick={onExportRoiDataset}>Export ROI‑normalized dataset</button>
        <button className="btn" onClick={onExportTop10RoiNarrative}>Export Top 10 ROI×Narrative</button>
        <button className="btn" onClick={onExportNarrativeChartAndAnalysis}>Export ROI×Narrative chart + analysis JSON</button>
        <button className="btn primary" onClick={onExportCroCalibration}>Calibrate CRO↔Pharma & export report</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" style={{ display:"none" }} onChange={(e) => {
        const f = e.target.files?.[0]; if (f) onImport(f);
        e.currentTarget.value = "";
      }} />
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button className="btn danger" onClick={resetToSeed}>Reset to seed</button>
        <button className="btn danger" onClick={() => {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          resetToSeed();
          saveToLocal();
        }}>Hard reset (clear + seed)</button>
        <button className="btn" onClick={repairModel}>Repair model (ensure critical flows)</button>
        <button className="btn" onClick={rebuildArrows}>Rebuild arrows (from seed)</button>
        <button className="btn" onClick={buildAutoTagPreview}>Auto-tag narrative (safe)</button>
      </div>
      {autoTagPreview && (
        <div style={{ marginTop: 10 }}>
          <div className="label">Auto-tag preview (no overwrites)</div>
          {autoTagPreview.length === 0 ? (
            <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>No eligible flows without narrative tags.</div>
          ) : (
            <>
              <table className="small" style={{ marginTop: 6, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>From → To</th><th>Edge</th><th>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {autoTagPreview.slice(0, 15).map((s, i) => (
                    <tr key={s.id}>
                      <td>{s.from} → {s.to}</td>
                      <td>{s.label}</td>
                      <td>{s.propose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 6, gap: 6 }}>
                <button className="btn primary" onClick={applyAutoTags}>Apply tags</button>
                <button className="btn" onClick={() => setAutoTagPreview(null)}>Dismiss</button>
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <div className="label">Verify critical flows</div>
        <ul className="small" style={{ marginTop: 6 }}>
          {[
            { from: "PBM", to: "Pharmacy", type: "money", label: "pharmacy reimbursements" },
            { from: "Payer", to: "PBM", type: "money", label: "rebate payments" },
            { from: "PBM", to: "Payer", type: "data", label: "rebate & formulary" },
            { from: "Provider", to: "Lab", type: "data", label: "orders" },
            { from: "Lab", to: "Provider", type: "data", label: "results" },
            { from: "Lab", to: "Payer", type: "data", label: "lab claims" },
            { from: "Payer", to: "Provider", type: "money", label: "adjudicated payments" },
            { from: "Provider", to: "Payer", type: "data", label: "claims & clinical" }
          ].map((spec, idx) => {
            const idByName = new Map(actors.map(a => [a.name, a.id] as const));
            const idByType = new Map(actors.map(a => [a.type as string, a.id] as const));
            const fromId = idByName.get(spec.from) || idByType.get(spec.from);
            const toId = idByName.get(spec.to) || idByType.get(spec.to);
            const matches = fromId && toId ? flows.filter(f => f.from === fromId && f.to === toId && f.type === (spec.type as any) && f.label === spec.label) : [];
            const ok = (matches?.length ?? 0) > 0;
            return (
              <li key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: ok ? "#10b981" : "#ef4444" }}>{ok ? "✓" : "✗"}</span>
                <span>{spec.from} → {spec.to} — {spec.label}</span>
                <button className="btn" style={{ marginLeft: "auto" }} onClick={() => {
                  try {
                    if (!cy || !fromId || !toId) return;
                    const sel = cy.edges().filter((e: any) => e.data("source") === fromId && e.data("target") === toId && String(e.data("type")) === String(spec.type));
                    sel.addClass("blast");
                    setTimeout(() => sel.removeClass("blast"), 1200);
                    cy.fit(sel, 30);
                  } catch {}
                }}>Flash</button>
              </li>
            );
          })}
        </ul>
      </div>
      {errors && (
        <div style={{ marginTop: 10 }}>
          <div className="label">Import errors</div>
          <ul className="small">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}
      <div className="small" style={{ marginTop: 10 }}>
        Storage key: <code>{STORAGE_KEY}</code>
      </div>
    </div>
  );
}


