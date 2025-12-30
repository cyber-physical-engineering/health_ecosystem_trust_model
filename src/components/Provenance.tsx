import { useState, useEffect } from "react";
import { useStore } from "@state/store";

export function Provenance() {
  const selection = useStore(s => s.selection);
  const flows = useStore(s => s.flows);
  const updateFlow = useStore(s => s.updateFlow);

  const flow = selection?.kind === "flow" ? flows.find(f => f.id === selection.id) : null;
  const [source, setSource] = useState<string>("");
  const [confidence, setConfidence] = useState<"Low" | "Medium" | "High" | "">("");

  useEffect(() => {
    if (!flow) { setSource(""); setConfidence(""); return; }
    setSource(((flow as any).source ?? "") as string);
    setConfidence((((flow as any).confidence ?? "") as any) || "");
  }, [flow?.id]);

  if (!selection || selection.kind !== "flow") {
    return (
      <div className="panel">
        <div className="small" style={{ lineHeight: 1.6, color: "var(--muted)" }}>
          Select an edge to edit its provenance (source and confidence).
        </div>
      </div>
    );
  }

  if (!flow) {
    return <div className="panel"><div className="small">Flow not found.</div></div>;
  }

  return (
    <div className="panel">
      <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Provenance: {flow.label || flow.type}</h3>
      <div className="form-grid">
        <div style={{ gridColumn: "1 / -1" }}>
          <div className="label">Source (URL or note)</div>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g., finance:FY24 or https://..."
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <div className="label">Confidence</div>
          <select value={confidence} onChange={(e) => setConfidence(e.target.value as any)}>
            <option value="">—</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="btn primary"
          onClick={() => updateFlow(flow.id, { source, confidence: confidence || undefined } as any)}
        >
          Save
        </button>
      </div>
    </div>
  );
}


