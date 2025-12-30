import { useState, useEffect } from "react";
import { GraphCanvas } from "@components/GraphCanvas";
import { Inspector } from "@components/Inspector";
import { ImportExport } from "@components/ImportExport";
import { Legend } from "@components/Legend";
import { Metrics } from "@components/Metrics";
import { Provenance } from "@components/Provenance";
import { useStore } from "@state/store";
import { ErrorBoundary } from "@components/ErrorBoundary";
import { Disclaimer } from "@components/Disclaimer";
import { DEFAULT_NARRATIVE, setSessionDefaultNarrative } from "@domain/flags";

type Tab = "Inspector" | "Import/Export" | "Analysis" | "Provenance" | "Legend";

export default function App() {
  // #region agent log
  try {
    console.log('[DEBUG] App.tsx:18 App component rendering');
    fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:18',message:'App component rendering',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch((e)=>console.error('[DEBUG] Fetch failed:',e));
  } catch (e) { console.error('[DEBUG] App.tsx:18 error:', e); }
  // #endregion
  
  const [tab, setTab] = useState<Tab>("Inspector");
  console.log('[DEBUG] App.tsx:25 Hooks initialized');
  
  const filters = useStore(s => s.filters);
  console.log('[DEBUG] App.tsx:28 Store accessed, filters:', filters);
  // #region agent log
  try {
    fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:25',message:'Store access successful',data:{filtersKeys:Object.keys(filters||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  } catch (err) {
    fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:28',message:'Store logging ERROR',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }
  // #endregion
  const toggleFlowType = useStore(s => s.toggleFlowType);
  const glowZTL = useStore(s => s.glowZTL);
  const setGlowZTL = useStore(s => s.setGlowZTL);
  const scenario = useStore(s => s.scenario);
  const setScenario = useStore(s => s.setScenario);
  const spread = useStore(s => s.spread);
  const setSpread = useStore(s => s.setSpread);
  const edgeLabelsHoverOnly = useStore(s => s.edgeLabelsHoverOnly);
  const setEdgeLabelsHoverOnly = useStore(s => s.setEdgeLabelsHoverOnly);
  const estimateDataDollarToggle = useStore(s => (s as any).estimateDataDollarToggle as boolean);
  const setEstimateDataDollarToggle = useStore(s => (s as any).setEstimateDataDollarToggle as (v: boolean) => void);
  const cy = useStore(s => (s as any).cy as any);
  const flows = useStore(s => s.flows);
  const updateFlow = useStore(s => s.updateFlow);

  useEffect(() => {
    try {
      if (DEFAULT_NARRATIVE === "neutral") return;
      const allProofOrUnset = flows.every(f => {
        const v = (f as any).narrativeValue as (string | undefined);
        return !v || v === "proof";
      });
      if (flows.length > 0 && allProofOrUnset) {
        setSessionDefaultNarrative("neutral");
        console.warn("[migration] Session default narrative set to 'neutral'. Set VITE_DEFAULT_NARRATIVE=neutral in .env.local.");
      }
    } catch {}
  }, [flows]);

  // One-time seeding of variability for audits/speed if missing (non-destructive; only fills unset fields)
  useEffect(() => {
    try {
      const key = "__seed_variability_v1";
      if (localStorage.getItem(key)) return;
      for (const f of flows) {
        // Set siteCount/violationRate defaults on audits if missing
        if (f.type === "audit") {
          const sc = (f as any).siteCount as (number | undefined);
          const vr = (f as any).violationRate as (number | undefined);
          let siteDefault = 1;
          let violDefault = 0.0;
          const label = (f.label || "").toLowerCase();
          if (label.includes("gmp")) { siteDefault = 3; violDefault = 0.10; }
          else if (label.includes("sdv")) { siteDefault = 2; violDefault = 0.05; }
          else if (label.includes("post-payment")) { siteDefault = 3; violDefault = 0.08; }
          else if (label.includes("clia")) { siteDefault = 1; violDefault = 0.03; }
          else if (label.includes("inspection")) { siteDefault = 2; violDefault = 0.06; }
          const patch: any = {};
          if (typeof sc !== "number") patch.siteCount = siteDefault;
          if (typeof vr !== "number") patch.violationRate = violDefault;
          if (Object.keys(patch).length > 0) updateFlow(f.id, patch);
        }
        // Set counterparties and cycleDays on some flows if missing to create speed variance
        const cp = (f as any).counterpartyCount as (number | undefined);
        const cd = (f as any).avgCycleDays as (number | undefined);
        const fromTo = `${f.from}-${f.to}`; // not used semantically; just placeholders
        const label = (f.label || f.type || "").toLowerCase();
        const patch2: any = {};
        if (typeof cp !== "number") {
          if (f.type === "audit") patch2.counterpartyCount = 3; // regulators
          else if (label.includes("claims") || label.includes("payments") || label.includes("reimburse")) patch2.counterpartyCount = 3;
          else if (label.includes("trial") || label.includes("batch")) patch2.counterpartyCount = 2;
          else patch2.counterpartyCount = 2;
        }
        if (typeof cd !== "number") {
          if (f.type === "audit") patch2.avgCycleDays = 45;
          else if (label.includes("claims") || label.includes("payments") || label.includes("reimburse")) patch2.avgCycleDays = 120;
          else if (label.includes("trial") || label.includes("batch")) patch2.avgCycleDays = 60;
          else patch2.avgCycleDays = 90;
        }
        if (Object.keys(patch2).length > 0) updateFlow(f.id, patch2);
      }
      localStorage.setItem(key, "1");
    } catch {}
  }, [flows, updateFlow]);

  // #region agent log
  try {
    fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:96',message:'Before return JSX',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  } catch {}
  // #endregion
  return (
    <div className="app">
      <Disclaimer />
      <div className="header">
        <h1>Health Ecosystem Trust Model</h1>
        <label className="chip">
          <input type="checkbox" checked={glowZTL} onChange={(e) => setGlowZTL(e.target.checked)} />
          ZTL insertion points
        </label>
        <label className="chip" style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={edgeLabelsHoverOnly} onChange={(e) => setEdgeLabelsHoverOnly(e.target.checked)} />
          Labels on hover
        </label>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as any)}
          className="chip"
          style={{ marginLeft: 8 }}
        >
          <option value="baseline">Scenario: Baseline</option>
          <option value="light">Scenario: Light proof (−15% TG)</option>
          <option value="strong">Scenario: Strong proof (−40% TG)</option>
        </select>
        <label className="chip" style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={!!estimateDataDollarToggle} onChange={(e) => setEstimateDataDollarToggle(e.target.checked)} />
          Estimate $ for data
        </label>
        <label className="chip" style={{ marginLeft: 8 }}>
          <span style={{ marginRight: 6 }}>Spread</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={spread}
            onChange={(e) => setSpread(Number(e.target.value) as any)}
          />
        </label>
        <button className="btn" style={{ marginLeft: 8 }} onClick={() => { try { cy?.fit(undefined, 20); cy?.center(); } catch {} }}>
          Reset view
        </button>
        <div style={{ marginLeft: "auto" }} />
        {(["data","money","audit"] as const).map(t => (
          <label key={t} className="chip">
            <input type="checkbox" checked={filters.flowTypeVisibility[t]} onChange={() => toggleFlowType(t)} />
            {t}
          </label>
        ))}
      </div>

      <div className="main">
        <div className="canvas">
          <ErrorBoundary>
            <GraphCanvas />
          </ErrorBoundary>
        </div>
        <div className="sidebar" onWheelCapture={(e) => e.stopPropagation()}>
          <div className="tabs">
            {(["Inspector","Import/Export","Analysis","Provenance","Legend"] as Tab[]).map(name => (
              <div
                key={name}
                className={"tab" + (tab === name ? " active" : "")}
                onClick={() => setTab(name)}
              >{name}</div>
            ))}
          </div>
          <div className="sidebar-content">
            <ErrorBoundary>
              {tab === "Inspector" && <Inspector />}
              {tab === "Import/Export" && <ImportExport />}
              {tab === "Analysis" && <Metrics />}
              {tab === "Provenance" && <Provenance />}
              {tab === "Legend" && <Legend />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}


