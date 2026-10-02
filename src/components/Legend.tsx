import React from "react";

type PartyLegendItem = { name: string; color: string };
type FlowLegendItem = { name: string; color: string };

const partyItems: PartyLegendItem[] = [
  { name: "Provider", color: "#60a5fa" },
  { name: "Hospital", color: "#38bdf8" },
  { name: "Payer", color: "#f59e0b" },
  { name: "Insurer", color: "#fcd34d" },
  { name: "PBM", color: "#fb7185" },
  { name: "PharmaMfg", color: "#22d3ee" },
  { name: "MedTech", color: "#34d399" },
  { name: "CRO", color: "#a78bfa" },
  { name: "CMO", color: "#f472b6" },
  { name: "Lab", color: "#fbbf24" },
  { name: "Pharmacy", color: "#c084fc" },
  { name: "EHRVendor", color: "#93c5fd" },
  { name: "Supplier", color: "#fde68a" },
  { name: "Distributor", color: "#fca5a5" },
  { name: "Patient", color: "#86efac" },
  { name: "Regulator", color: "#f87171" },
  { name: "Govt", color: "#ef4444" }
];

const flowItems: FlowLegendItem[] = [
  { name: "data", color: "#7dd3fc" },
  { name: "money", color: "#fbbf24" },
  { name: "audit", color: "#f87171" }
];

function Swatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        borderRadius: 4,
        background: color,
        marginRight: 8,
        border: "1px solid rgba(0,0,0,0.35)"
      }}
    />
  );
}

function LineSample({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width={64} height={12} style={{ marginRight: 8 }}>
      <line
        x1={2}
        y1={6}
        x2={62}
        y2={6}
        stroke={color}
        strokeWidth={4}
        strokeDasharray={dashed ? "6 4" : undefined}
        strokeLinecap="round"
      />
      <polygon points="56,6 62,3 62,9" fill={color} />
    </svg>
  );
}

export function Legend() {
  return (
    <div className="panel">
      <div style={{ marginBottom: 12 }} className="small">
        <b>Risk heatmap</b>: node border color
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Swatch color="#10b981" /> <span>Low</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Swatch color="#f59e0b" /> <span>Medium</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Swatch color="#ef4444" /> <span>High</span>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          Derived from sensitive data flows (sensitivity ≥ 60) and trust gaps.
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="label">Parties</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {partyItems.map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center" }}>
              <Swatch color={p.color} />
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      <hr />

      <div style={{ marginTop: 12 }}>
        <div className="label">Flows</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {flowItems.map((f) => (
            <div key={f.name} style={{ display: "flex", alignItems: "center" }}>
              <LineSample color={f.color} />
              <span style={{ textTransform: "capitalize" }}>{f.name}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }} className="small">
          <div>- Edge color indicates type (data, money, audit)</div>
          <div>- Edge width scales with volume</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
            <LineSample color="#9aa0a6" dashed />
            <span>Dashed = high trust gap (≥ 60)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
            <LineSample color="#e879f9" dashed />
            <span>BAA gap: sensitive data from a provider, hospital or payer to a PBM, EHR vendor, CRO or CMO, with no BAA recorded</span>
          </div>
          <div style={{ marginTop: 4 }}>
            - With "ZTL insertion points" on, flows with trust gap ≥ 60 and sensitivity ≥ 60 are drawn in white (money flows in purple). ZTL is the ZeroTrust Ledger.
          </div>
          <div style={{ marginTop: 4 }}>
            - (est.) indicates modeled dollar values for data flows; money flows use actual dollars when provided
          </div>
          <div style={{ marginTop: 4 }}>- Arrow points from source to target</div>
          <div style={{ marginTop: 4 }}>
            - Compliance details (classification, legal basis, encryption) appear in the Inspector when a flow is selected
          </div>
        </div>
      </div>

      <hr />

      <div style={{ marginTop: 12 }}>
        <div className="label">UI Toggles</div>
        <ul className="small" style={{ marginTop: 6, lineHeight: 1.6 }}>
          <li>Scenario: applies a temporary trust gap reduction on ZTL-eligible edges</li>
          <li>Spread: adjusts layout spacing for readability</li>
          <li>Labels on hover: hides edge labels until hovered/selected</li>
        </ul>
      </div>
    </div>
  );
}


