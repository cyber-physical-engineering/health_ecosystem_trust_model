import { useStore } from "@state/store";
import { FEATURE_NEW_ROI_MATH } from "@domain/flags";
import { interopFactor, cadenceFactor as cadenceFactorV2, clamp as clampV2, volumeBoost, partyDrag, speedToPilotBoost, speedToPilotScore01 } from "@domain/math";
import { narrativeToScore, strategicFitOf } from "@domain/roi";

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const actors = useStore((s) => s.actors);
  const updateFlow = useStore((s) => s.updateFlow);
  const flows = useStore((s) => s.flows);

  if (!selection) {
    return (
      <div className="panel">
        <div className="small" style={{ lineHeight: 1.6, color: "var(--muted)" }}>
          Click a node or edge to view its details.
        </div>
      </div>
    );
  }

  if (selection.kind === "actor") {
    const actor = actors.find((a) => a.id === selection.id);
    if (!actor) return <div className="panel"><div className="small">Actor not found.</div></div>;

    return (
      <div className="panel">
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Actor: {actor.name}</h3>
        <div className="form-grid">
          <div>
            <div className="label">Type</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{actor.type}</div>
          </div>
          <div>
            <div className="label">Trust Score</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{actor.trustScore}</div>
          </div>
          <div>
            <div className="label">Conflict Score</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{actor.conflictScore}</div>
          </div>
          <div>
            <div className="label">Incentives</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
              {actor.incentives.length > 0 ? actor.incentives.join(", ") : "—"}
            </div>
          </div>
          <div>
            <div className="label">Trust Liabilities</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
              {actor.trustLiabilities.length > 0 ? actor.trustLiabilities.join(", ") : "—"}
            </div>
          </div>
          <div>
            <div className="label">Data Assets</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
              {actor.dataAssets.length > 0 ? actor.dataAssets.join(", ") : "—"}
            </div>
          </div>
          {actor.notes && (
            <div>
              <div className="label">Notes</div>
              <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{actor.notes}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selection.kind === "flow") {
    const flow = flows.find((f) => f.id === selection.id);
    if (!flow) return <div className="panel"><div className="small">Flow not found.</div></div>;
    const fromActor = actors.find((a) => a.id === flow.from);
    const toActor = actors.find((a) => a.id === flow.to);

    // Compliance recommendations (lightweight heuristics)
    const isCE = (t?: string) => ["Provider","Hospital","Payer","PharmaMfg"].includes(String(t));
    const isBA = (t?: string) => ["PBM","EHRVendor","CRO","CMO","Lab","Pharmacy"].includes(String(t));
    const sensitivity = flow.sensitivity ?? 0;
    const trustGap = flow.trustGap ?? 0;
    const isData = flow.type === "data";
    const baaGap = isData && sensitivity >= 60 && isCE(fromActor?.type) && isBA(toActor?.type);
    const highRisk = isData && sensitivity >= 60 && trustGap >= 60;

    type Rec = { text: string; cites?: string[] };
    const recs: Rec[] = [];
    if (baaGap) {
      recs.push(
        { text: "Execute/update Business Associate Agreement (BAA)", cites: [
          "HIPAA 45 CFR 164.502(e)", "HIPAA 45 CFR 164.504(e)"
        ]},
        { text: "Limit to minimum necessary PHI", cites: ["HIPAA 45 CFR 164.502(b)"]},
        { text: "Vendor risk assessment + evidence (e.g., SOC 2, HITRUST)", cites: [
          "HIPAA 45 CFR 164.308(a)(1)(ii)(A) Risk analysis",
          "HIPAA 45 CFR 164.308(b)(1) Business associate arrangements",
          "HIPAA 45 CFR 164.308(a)(8) Evaluation"
        ]},
        { text: "Define incident reporting and breach notification timelines", cites: [
          "HIPAA 45 CFR 164.410 (BA notification)", "HIPAA 45 CFR 164.404–406 (Notification)"
        ]}
      );
    }
    if (highRisk) {
      recs.push(
        { text: "Encrypt in transit (TLS 1.2+) and at rest", cites: [
          "HIPAA 45 CFR 164.312(e)(1) Transmission security",
          "HIPAA 45 CFR 164.312(a)(2)(iv) Encryption (addressable)",
          "FDA 21 CFR Part 11 (11.10) Controls for electronic records"
        ]},
        { text: "Enable immutable access logging + alerting", cites: [
          "HIPAA 45 CFR 164.312(b) Audit controls",
          "HIPAA 45 CFR 164.308(a)(1)(ii)(D) Information system activity review",
          "FDA 21 CFR 11.10(e) Secure, computer-generated, time-stamped audit trails"
        ]},
        { text: "MFA for privileged access; least privilege RBAC", cites: [
          "HIPAA 45 CFR 164.312(d) Person/entity authentication",
          "HIPAA 45 CFR 164.308(a)(4) Information access management",
          "HIPAA 45 CFR 164.312(a)(1) Access control"
        ]},
        { text: "Data Loss Prevention on outbound PHI", cites: [
          "HIPAA 45 CFR 164.312(e)(1)", "HIPAA 45 CFR 164.308(a)(1)(ii)(A) Risk analysis"
        ]},
        { text: "Continuous monitoring of this interface", cites: [
          "HIPAA 45 CFR 164.308(a)(1)(ii)(D) Activity review",
          "HIPAA 45 CFR 164.308(a)(8) Evaluation"
        ]}
      );
    }
    if (flow.type === "money") {
      recs.push(
        { text: "Segregation of duties for payment approval", cites: [
          "HIPAA 45 CFR 164.308(a)(3) Workforce security (role-based)",
          "NIST SP 800-53 AC-5 Separation of Duties (mapping)"
        ]},
        { text: "Tamper-evident audit trail for financial events", cites: [
          "HIPAA 45 CFR 164.312(b) Audit controls",
          "FDA 21 CFR 11.10(e) Audit trails"
        ]}
      );
    }
    
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
      if (typeof units === "number" && typeof unitVal === "number") {
        return { amountUSD: units * unitVal, estimated: true };
      }
      return { amountUSD: undefined as number | undefined, estimated: false };
    };
    const fmtUSD = (n?: number) => typeof n === "number" ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) : "—";
    const interopMultiplier = (e: any) => interopFactor((e?.interopComplexity as string | undefined) || "JSON");
    const baseAssuranceNeed = (e: any) => {
      const { amountUSD } = amountInfo(e);
      const f = (e?.friction ?? 0) / 100;
      const t = (e?.trustGap ?? 0) / 100;
      if (typeof amountUSD !== "number") return 0;
      return amountUSD * f * t;
    };
    const adjustedAssuranceNeed = (e: any) => baseAssuranceNeed(e) * interopMultiplier(e);
    const integrationPenaltyUSD = (e: any) => {
      const base = baseAssuranceNeed(e);
      const mult = interopMultiplier(e);
      return base * Math.max(0, mult - 1);
    };
    const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
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
      for (const f of flows) {
        if (f.type !== "audit") continue;
        const fl = (f as any).linkedFlowId as string | undefined;
        if (f.id === e.id || f.id === lid || (fl && (fl === e.id || fl === lid))) {
          total += auditPressureForAuditEdge(f);
        }
      }
      return total;
    };
    const legalExpenseByEdge = (e: any) => {
      if (e?.type !== "money") return 0;
      const tx = ((e as any).txCount ?? null) as number | null;
      const dispute = ((e as any).disputeRatePct ?? 0) / 100;
      const litig = ((e as any).litigationRatePct ?? 0) / 100;
      const cDispute = ((e as any).avgDisputeCostUSD ?? 0) as number;
      const cLit = ((e as any).avgLitigationCostUSD ?? 0) as number;
      if (!tx) return 0;
      const expectedCostPerTx = dispute * ((1 - litig) * cDispute + litig * cLit);
      return tx * expectedCostPerTx;
    };
    const baseRoi = (e: any) => {
      const need = adjustedAssuranceNeed(e);
      const legal = legalExpenseByEdge(e);
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
    const speedScore = (e: any) => {
      const mult = interopMultiplier(e);
      const lid = (e?.linkedFlowId as string | undefined) || null;
      const hasAudit = flows.some(f => f.type === "audit" && ((f as any).linkedFlowId === e.id || (f as any).linkedFlowId === lid || f.id === e.id || f.id === lid));
      const parties = 2 + (hasAudit ? 1 : 0);
      return 1 / (mult * parties);
    };

    return (
      <div className="panel">
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Flow: {flow.label || flow.type}</h3>
        <div className="form-grid">
          <div>
            <div className="label">From</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{fromActor?.name || "?"}</div>
          </div>
          <div>
            <div className="label">To</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{toActor?.name || "?"}</div>
          </div>
          <div>
            <div className="label">Type</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{flow.type}</div>
          </div>
          <div>
            <div className="label">Volume</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{flow.volume ?? "—"}</div>
          </div>
          {flow.type === "money" && (
            <div>
              <div className="label">Dollar Value</div>
              <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).dollarValue ?? "—"}</div>
            </div>
          )}
          {flow.type === "money" && (
            <>
              <div>
                <div className="label">Transactions (txCount)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).txCount ?? "—"}</div>
              </div>
              <div>
                <div className="label">Dispute Rate (%)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).disputeRatePct ?? "—"}</div>
              </div>
              <div>
                <div className="label">Litigation Rate of Disputes (%)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).litigationRatePct ?? "—"}</div>
              </div>
              <div>
                <div className="label">Avg Dispute Cost (USD)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).avgDisputeCostUSD ?? "—"}</div>
              </div>
              <div>
                <div className="label">Avg Litigation Cost (USD)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).avgLitigationCostUSD ?? "—"}</div>
              </div>
            </>
          )}
          {/* Unified economic value fields */}
          <div>
            <div className="label">Economic Value (USD)</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
              {(() => {
                const { amountUSD, estimated } = amountInfo(flow as any);
                const basis = (flow as any).valueBasis as ("actual" | "estimate" | undefined);
                const suffix = estimated || basis === "estimate" ? " (est.)" : "";
                return `${fmtUSD(amountUSD)}${suffix}`;
              })()}
            </div>
          </div>
          <div>
            <div className="label">Basis</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).valueBasis ?? "—"}</div>
          </div>
          <div>
            <div className="label">Market Scale</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).marketScale ?? "—"}</div>
          </div>
          <div>
            <div className="label">Method</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).valueMethod ?? "—"}</div>
          </div>
          <div>
            <div className="label">Unit × Unit Price</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
              {(() => {
                const unit = (flow as any).unit as string | undefined;
                const unitValue = (flow as any).unitValueUSD as number | undefined;
                if (!unit || typeof unitValue !== "number") return "—";
                return `${unit} × ${fmtUSD(unitValue)}`;
              })()}
            </div>
          </div>
          <div>
            <div className="label">Unit Count</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).unitCount ?? "—"}</div>
          </div>
          <div>
            <div className="label">Frequency</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).frequency ?? "—"}</div>
          </div>
          <div>
            <div className="label">Interop Complexity</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).interopComplexity ?? "—"}</div>
          </div>
          {/* Data-specific compliance details */}
          {flow.type === "data" && (
            <>
              <div>
                <div className="label">Classification</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).classification ?? "—"}</div>
              </div>
              <div>
                <div className="label">Legal Basis</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).legalBasis ?? "—"}</div>
              </div>
              <div>
                <div className="label">Retention (days)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).retentionDays ?? "—"}</div>
              </div>
              <div>
                <div className="label">Encryption In Transit</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).encryptionInTransit === true ? "Yes" : (flow as any).encryptionInTransit === false ? "No" : "—"}</div>
              </div>
              <div>
                <div className="label">Encryption At Rest</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).encryptionAtRest === true ? "Yes" : (flow as any).encryptionAtRest === false ? "No" : "—"}</div>
              </div>
            </>
          )}
          {/* Money-specific finance ops */}
          {flow.type === "money" && (
            <>
              <div>
                <div className="label">Payment Terms (days)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).paymentTermsDays ?? "—"}</div>
              </div>
              <div>
                <div className="label">DSO (days)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).dsoDays ?? "—"}</div>
              </div>
              <div>
                <div className="label">Chargeback Rate (%)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).chargebackRatePct ?? "—"}</div>
              </div>
            </>
          )}
          {/* Audit program details */}
          {flow.type === "audit" && (
            <>
              <div>
                <div className="label">Cadence</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).cadence ?? "—"}</div>
              </div>
              <div>
                <div className="label">Sites (siteCount)</div>
                <input className="small" type="number" min={1} step={1}
                  value={(flow as any).siteCount ?? 1}
                  onChange={(e) => { try { updateFlow(flow.id, { siteCount: Number(e.target.value) }); } catch {} }}
                  style={{ width: "100%", padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }} />
              </div>
              <div>
                <div className="label">Violation Rate (0–1)</div>
                <input className="small" type="number" min={0} max={1} step={0.05}
                  value={(flow as any).violationRate ?? 0}
                  onChange={(e) => { try { updateFlow(flow.id, { violationRate: Number(e.target.value) }); } catch {} }}
                  style={{ width: "100%", padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }} />
              </div>
              <div>
                <div className="label">Last Audit Date</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).lastAuditDate ?? "—"}</div>
              </div>
              <div>
                <div className="label">Next Due Date</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).nextDueDate ?? "—"}</div>
              </div>
              <div>
                <div className="label">Open Findings</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).findingsOpen ?? "—"}</div>
              </div>
              <div>
                <div className="label">Avg Audit Cost (USD)</div>
                <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{(flow as any).avgAuditCostUSD ?? "—"}</div>
              </div>
            </>
          )}
          <div>
            <div className="label">Sensitivity</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{flow.sensitivity ?? "—"}</div>
          </div>
          <div>
            <div className="label">Friction</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{flow.friction ?? "—"}</div>
          </div>
          {/* Strategic fit sliders */}
          <div>
            <div className="label">Access (0.9–1.2)</div>
            <input className="small" type="range" min={0.9} max={1.2} step={0.01}
              value={(flow as any).accessFactor ?? 1.0}
              onChange={(e) => { try { updateFlow(flow.id, { accessFactor: Number(e.target.value) }); } catch {} }}
              style={{ width: "100%" }} />
          </div>
          <div>
            <div className="label">Referenceability (0.9–1.15)</div>
            <input className="small" type="range" min={0.9} max={1.15} step={0.01}
              value={(flow as any).referenceabilityFactor ?? 1.0}
              onChange={(e) => { try { updateFlow(flow.id, { referenceabilityFactor: Number(e.target.value) }); } catch {} }}
              style={{ width: "100%" }} />
          </div>
          <div>
            <div className="label">Vertical Fit (0.9–1.15)</div>
            <input className="small" type="range" min={0.9} max={1.15} step={0.01}
              value={(flow as any).verticalFitFactor ?? 1.0}
              onChange={(e) => { try { updateFlow(flow.id, { verticalFitFactor: Number(e.target.value) }); } catch {} }}
              style={{ width: "100%" }} />
          </div>
          <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
            Strategic Fit: {(() => strategicFitOf(flow as any).toFixed(2))()}
          </div>
          <div>
            <div className="label">Trust Gap</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>{flow.trustGap ?? "—"}</div>
          </div>
          <div>
            <div className="label">Narrative Value</div>
            <select
              className="small"
              value={(flow as any).narrativeValue || "proof"}
              onChange={(e) => { try { updateFlow(flow.id, { narrativeValue: e.target.value as any }); } catch {} }}
              style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px", width: "100%" }}
            >
              {(["proof","innovation","compliance","cost"] as const).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Computed metrics for this flow */}
        <div style={{ marginTop: 12 }}>
          <div className="label">Computed (this flow)</div>
          <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px", lineHeight: 1.6 }}>
            <div>Preventable Friction (adj.): {fmtUSD(adjustedAssuranceNeed(flow as any))}</div>
            <div>Integration Penalty: {fmtUSD(integrationPenaltyUSD(flow as any))}</div>
            <div>Audit Pressure: {fmtUSD(auditPressureByEdge(flow as any))}</div>
            <div>Legal Exposure: {fmtUSD(legalExpenseByEdge(flow as any))}</div>
            <div>ROI Composite: {fmtUSD(roiComposite(flow as any))}</div>
            {!FEATURE_NEW_ROI_MATH && (
              <div>Speed‑to‑Pilot score: {speedScore(flow as any).toFixed(3)} (modifier +{fmtUSD(speedScore(flow as any) * 1_000_000)})</div>
            )}
            {FEATURE_NEW_ROI_MATH && (
              <div style={{ marginTop: 6, opacity: 0.95 }}>
                <div>volumeBoost: {volumeBoost((flow as any).txCount).toFixed(2)}</div>
                <div>partyDrag: {partyDrag((flow as any).counterpartyCount).toFixed(2)}</div>
                <div>speedToPilotBoost: {fmtUSD(speedToPilotBoost((flow as any).avgCycleDays, (flow as any).interopComplexity))}</div>
              </div>
            )}
            <div>ROI (normalized): {fmtUSD(roiNormalized(flow as any))}</div>
            <div>Narrative score: {(() => { const n = narrativeToScore((flow as any).narrativeValue as any); return n.toFixed(2); })()}</div>
            <div>Combined ROI×Narrative×Fit: {(() => { const roi = roiNormalized(flow as any); const n = narrativeToScore((flow as any).narrativeValue as any); const sf = strategicFitOf(flow as any); const sp = speedToPilotScore01((flow as any).avgCycleDays, (flow as any).interopComplexity, (flow as any).counterpartyCount); const isAudit = flow.type === "audit"; const sc = (flow as any).siteCount ?? 1; const fnd = (flow as any).findingsOpen ?? 0; const auditGuard = (isAudit && (sc < 3 || fnd < 3)) ? 0.90 : 1.0; return fmtUSD((roi * (n * 1.10) * (sf * 1.05) + 0.02 * sp) * auditGuard); })()}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="label">Provenance</div>
          <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
            <div>Source: {(flow as any).source || "—"}</div>
            <div>Confidence: {(flow as any).confidence || "—"}</div>
          </div>
        </div>
        {Boolean((flow as any).linkedFlowId) && (
          <div style={{ marginTop: 12 }}>
            <div className="label">Related Flow</div>
            <div className="small" style={{ padding: "8px", background: "var(--panel-elevated)", borderRadius: "6px" }}>
              {(() => {
                const lf = flows.find(f => f.id === (flow as any).linkedFlowId);
                if (!lf) return "—";
                const src = actors.find(a => a.id === lf.from)?.name || "?";
                const dst = actors.find(a => a.id === lf.to)?.name || "?";
                return `${src} → ${dst} — ${lf.label || lf.type}`;
              })()}
            </div>
          </div>
        )}
        {recs.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="label">Compliance recommendations</div>
            <ul className="small" style={{ lineHeight: 1.6, margin: "8px 0 0 16px" }}>
              {recs.map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <div>{r.text}</div>
                  {r.cites && r.cites.length > 0 && (
                    <div style={{ color: "var(--muted)", marginTop: 2 }}>
                      {r.cites.join(" • ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return null;
}


