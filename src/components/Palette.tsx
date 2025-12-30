import { useStore } from "@state/store";
import { useState } from "react";
import type { FlowType } from "@domain/schema";

export function Palette() {
  const addActor = useStore(s => s.addActor);
  const addFlow = useStore(s => s.addFlow);
  const deleteActor = useStore(s => s.deleteActor);
  const deleteFlow = useStore(s => s.deleteFlow);
  const selection = useStore(s => s.selection);
  const selectionHistory = useStore(s => s.selectionHistoryNodeIds);
  const toggleFlowType = useStore(s => s.toggleFlowType);
  const setFilterRange = useStore(s => s.setFilterRange);
  const filters = useStore(s => s.filters);
  const setSelection = useStore(s => s.setSelection);
  const cy = useStore(s => (s as any).cy) as any;
  const [query, setQuery] = useState("");

  const canDelete = Boolean(selection);

  const handleAddFlow = (type: FlowType) => {
    const [a, b] = selectionHistory;
    if (a && b) addFlow(a, b, type);
  };

  return (
    <div className="panel">
      <div>
        <div className="label">Search actor</div>
        <div className="row" style={{ gap: 6 }}>
          <input
            type="text"
            placeholder="Type actor name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={() => {
            const q = query.trim().toLowerCase();
            if (!q) return;
            const state = useStore.getState() as any;
            const actor = state.actors.find((a: any) => String(a.name).toLowerCase().includes(q));
            if (!actor) return;
            setSelection({ kind: "actor", id: actor.id });
            try {
              const el = cy?.$id?.(actor.id);
              if (el && el.length) {
                cy.center(el);
                cy.animate({ fit: { eles: el, padding: 40 } }, { duration: 250 });
              }
            } catch {}
          }}>Focus</button>
        </div>
      </div>
      <hr />
      <div className="row">
        <button className="btn primary" onClick={addActor}>Add Actor</button>
        <button className="btn" onClick={() => handleAddFlow("data")}>Add Flow (data)</button>
      </div>
      <div className="row" style={{ marginTop: 6, gap:6 }}>
        <button className="btn" onClick={() => handleAddFlow("money")}>Flow: money</button>
        <button className="btn" onClick={() => handleAddFlow("audit")}>Flow: audit</button>
      </div>
      <div className="small" style={{ marginTop: 6 }}>Uses last two selected nodes.</div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn danger" disabled={!canDelete} onClick={() => {
          if (!selection) return;
          if (selection.kind === "actor") deleteActor(selection.id);
          if (selection.kind === "flow") deleteFlow(selection.id);
        }}>Delete Selected</button>
      </div>

      <hr />

      <div>
        <div className="label">Filter: Flow Types</div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {(["data","money","audit"] as FlowType[]).map(t => (
            <label key={t} className="chip">
              <input type="checkbox" checked={filters.flowTypeVisibility[t]} onChange={() => toggleFlowType(t)} />
              {t}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <Range label="Trust Gap" value={filters.trustGap} onChange={(v) => setFilterRange("trustGap", v)} />
        <Range label="Sensitivity" value={filters.sensitivity} onChange={(v) => setFilterRange("sensitivity", v)} />
        <Range label="Friction" value={filters.friction} onChange={(v) => setFilterRange("friction", v)} />
      </div>
    </div>
  );
}

function Range({ label, value, onChange }: { label: string; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const [min, max] = value;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="label">{label}: {min} – {max}</div>
      <div className="row">
        <input type="range" min={0} max={100} value={min} onChange={(e) => onChange([Number(e.target.value), max])} />
        <input type="range" min={0} max={100} value={max} onChange={(e) => onChange([min, Number(e.target.value)])} />
      </div>
    </div>
  );
}


