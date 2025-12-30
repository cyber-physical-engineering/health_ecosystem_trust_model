/**
 * GraphCanvas.tsx — Cytoscape renderer for the health trust model
 */
import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, {
  Core,
  EdgeSingular,
  ElementDefinition,
  NodeSingular
} from "cytoscape";
import dagre from "cytoscape-dagre";
import svg from "cytoscape-svg";
import { useStore } from "@state/store";
import type { Actor, FlowType } from "@domain/schema";

cytoscape.use(dagre);
cytoscape.use(svg as any);

function updateZtlClasses(cy: Core | null, enabled: boolean) {
  if (!cy) return;
  cy.batch(() => {
    cy.edges().forEach((edge) => {
      const trustGap = Number(edge.data("trustGap") ?? 0);
      const sensitivity = Number(edge.data("sensitivity") ?? 0);
      const eligible = trustGap >= 60 && sensitivity >= 60;
      const isMoney = String(edge.data("type")) === "money";

      if (enabled && eligible) {
        edge.addClass("ztl");
        if (isMoney) edge.addClass("ztl-money");
        else edge.removeClass("ztl-money");
      } else {
        edge.removeClass("ztl");
        edge.removeClass("ztl-money");
      }
    });
  });
}

const nodeColors: Record<Actor["type"], string> = {
  Provider: "#60a5fa",
  Payer: "#f59e0b",
  PharmaMfg: "#22d3ee",
  MedTech: "#34d399",
  CRO: "#a78bfa",
  CMO: "#f472b6",
  Regulator: "#f87171",
  Hospital: "#38bdf8",
  Lab: "#fbbf24",
  EHRVendor: "#93c5fd",
  PBM: "#fb7185",
  Patient: "#86efac",
  Supplier: "#fde68a",
  Distributor: "#fca5a5",
  Insurer: "#fcd34d",
  Govt: "#ef4444",
  Pharmacy: "#c084fc"
};

const edgeColors: Record<FlowType, string> = {
  data: "#7dd3fc",
  money: "#fbbf24",
  audit: "#f87171"
};

type Tooltip = { x: number; y: number; content: JSX.Element } | null;

type ElementsBundle = {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
};

function applyEdgeOffsets(cy: Core) {
  cy.batch(() => {
    const groups = new Map<string, EdgeSingular[]>();
    cy.edges().forEach((edge) => {
      const key = `${edge.data("source") as string}->${edge.data("target") as string}`;
      const arr = groups.get(key);
      if (arr) arr.push(edge);
      else groups.set(key, [edge]);
    });

    groups.forEach((edges) => {
      const sorted = edges
        .slice()
        .sort((a, b) => {
          const typeCompare = String(a.data("type") ?? "").localeCompare(
            String(b.data("type") ?? "")
          );
          if (typeCompare !== 0) return typeCompare;
          return a.id().localeCompare(b.id());
        });

      const total = sorted.length;
      sorted.forEach((edge, idx) => {
        // Geometry (guarded for safety)
        const srcPos = edge.source().position() || { x: 0, y: 0 };
        const tgtPos = edge.target().position() || { x: 0, y: 0 };
        const dx = (tgtPos.x ?? 0) - (srcPos.x ?? 0);
        const dy = (tgtPos.y ?? 0) - (srcPos.y ?? 0);
        const edgeLen = Math.max(1, Math.hypot(dx, dy));

        // Label metrics (estimate)
        const label = String(edge.data("label") || "");
        const labelPx = Math.max(60, Math.min(240, label.length * 6.5));

        // Safe interval along edge away from nodes/arrowheads and accommodating label width
        const nodePadPx = 80;            // more clearance from nodes
        const arrowPadPx = 28;           // extra clearance from arrowheads
        const fracPad = Math.min(0.45, (nodePadPx + arrowPadPx + labelPx * 0.6) / edgeLen);
        let safeStart = Math.max(0.12, fracPad);
        let safeEnd = Math.min(0.88, 1 - fracPad);
        if (!(safeEnd > safeStart + 0.02)) {
          // Fallback safe window if edge is extremely short
          safeStart = 0.4; safeEnd = 0.6;
        }

        // Distribute parallel edges within safe interval
        const t = total === 1 ? 0.5 : idx / Math.max(1, total - 1);
        let weight = safeStart + t * (safeEnd - safeStart);
        // Center bias to keep labels away from arrowheads and nodes
        weight = 0.5 + (weight - 0.5) * 0.80;
        if (!isFinite(weight)) weight = 0.5;
        weight = Math.max(0.15, Math.min(0.85, weight));

        // For very short edges relative to label width, push label further from source
        const isVeryShort = edgeLen < labelPx * 1.4;
        if (isVeryShort) {
          if (dx >= 0) {
            weight = Math.min(safeEnd - 0.05, Math.max(0.68, weight));
          } else {
            weight = Math.max(safeStart + 0.05, Math.min(0.32, weight));
          }
        }

        // Keep labels near the center band (except very short edges where we purposefully bias)
        if (!isVeryShort) {
          weight = Math.max(0.35, Math.min(0.65, weight));
        }

        // Perpendicular separation between parallel edges
        const relative = total % 2 === 0 ? idx - total / 2 + 0.5 : idx - (total - 1) / 2;
        const baseSep = (total > 2 ? 36 : 24) + (label.length > 14 ? 6 : 0);
        let perpendicular = relative * baseSep;
        const maxPerp = Math.max(10, edgeLen * 0.20);
        if (Math.abs(perpendicular) > maxPerp) perpendicular = Math.sign(perpendicular) * maxPerp;

        // For predominantly horizontal edges, reduce perpendicular more (keep label near the curve)
        if (Math.abs(dx) > Math.abs(dy) * 1.8) {
          perpendicular *= 0.6;
        }

        // Along-edge shift: for very short edges, nudge text further from source by a few px
        const parallel = isVeryShort ? (dx >= 0 ? 12 : -12) : 0;

        // Curve distance scaled by edge length
        const distance = Math.max(70, Math.min(220, 70 + edgeLen * 0.22));

        // Apply (guard all numbers)
        edge.style("text-margin-y", `${isFinite(perpendicular) ? perpendicular : 0}`);
        edge.style("text-margin-x", `${isFinite(parallel) ? parallel : 0}`);
        edge.style("control-point-distance", `${isFinite(distance) ? distance : 80}`);
        edge.style("control-point-weight", `${isFinite(weight) ? weight : 0.5}`);
      });
    });
  });
}

function getDagreLayoutOptions(spread: 0 | 1 | 2 | 3) {
  const multipliers = [1, 1.5, 2, 2.5];
  const m = multipliers[spread] ?? 1.5;
  const baseNodeSep = 40;
  const baseRankSep = 60;
  const baseEdgeSep = 40;
  return {
  name: "dagre",
  rankDir: "LR",
    nodeSep: Math.round(baseNodeSep * m),
    rankSep: Math.round(baseRankSep * m),
    edgeSep: Math.round(baseEdgeSep * m),
    ranker: "tight-tree"
} as any;
}

function runLayoutWithFit(cy: Core, spread: 0 | 1 | 2 | 3) {
  const layout = cy.layout(getDagreLayoutOptions(spread));
  layout.on("layoutstop", () => {
    applyEdgeOffsets(cy);
    cy.resize();
    const pad = 10;
    (cy as any).fit(undefined, pad);
    // If there's significant letterboxing vertically, gently zoom to use more height
    try {
      const bb = cy.elements().boundingBox({ includeLabels: true } as any);
      const rect = (cy.container() as HTMLElement).getBoundingClientRect();
      const zoomH = (rect.height - pad * 2) / Math.max(1, bb.h);
      const zoomW = (rect.width - pad * 2) / Math.max(1, bb.w);
      if (zoomH > zoomW * 1.25) { // lots of empty vertical space
        cy.zoom(zoomH * 0.98);
        cy.center(cy.elements());
      }
    } catch {}
  });
  layout.run();
}

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const updatingSelectionRef = useRef(false); // Flag to prevent infinite selection loop
  const actors = useStore((s) => s.actors);
  const flows = useStore((s) => s.flows);
  const filters = useStore((s) => s.filters);
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const glowZTL = useStore((s) => s.glowZTL);
  const scenario = useStore((s) => s.scenario);
  const spread = useStore((s) => s.spread);
  const edgeLabelsHoverOnly = useStore((s) => s.edgeLabelsHoverOnly);
  const setCy = useStore((s) => s.setCy);

  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const glowZtlRef = useRef(glowZTL);

  const getVisibleFlows = useStore((s) => s.visibleFlows);

  useEffect(() => { glowZtlRef.current = glowZTL; }, [glowZTL]);

  const elements = useMemo<ElementsBundle>(() => {
    try {
      // Use the same filtered list as Analysis, so canvas and metrics are consistent
      const visibleFlows = getVisibleFlows();
      // For node risk, still compute from scenario-adjusted full flows
      const factor = scenario === "light" ? 0.85 : scenario === "strong" ? 0.6 : 1;
      const adjustedFlows = flows.map((fl) => {
        const tg = fl.trustGap ?? 0;
        const sens = fl.sensitivity ?? 0;
        const eligible = tg >= 60 && sens >= 60;
        const adjTg = Math.round(eligible ? tg * factor : tg);
        return { ...fl, trustGap: adjTg } as typeof fl;
      });
      // Build quick lookup for actor types
      const actorById = new Map<string, Actor>();
      for (const a of actors) {
        if (a?.id && a?.name && a?.type) {
          actorById.set(a.id, a as Actor);
        }
      }

    // Compute simple risk score per node from sensitive data flows
    const HIGH_SENS = 60;
    const riskByNode = new Map<string, number>();
    for (const f of adjustedFlows) {
      if (f.type !== "data") continue;
      const sens = f.sensitivity ?? 0;
      if (sens < HIGH_SENS) continue;
      const gap = f.trustGap ?? 0;
      const volume = f.volume ?? 10;
      const score = Math.max(0, Math.min(100, gap + Math.min(40, volume)));
      riskByNode.set(f.from, (riskByNode.get(f.from) ?? 0) + score);
      riskByNode.set(f.to, (riskByNode.get(f.to) ?? 0) + Math.round(score * 0.6));
    }

    const nodes: ElementDefinition[] = actors.map((a) => ({
      group: "nodes",
      data: {
        id: a.id,
        label: a.name,
        type: a.type,
        trustScore: a.trustScore,
        conflictScore: a.conflictScore,
        incentives: a.incentives,
        liabilities: a.trustLiabilities,
        assets: a.dataAssets,
        risk: Math.min(100, Math.round(riskByNode.get(a.id) ?? 0))
      }
    }));

    const edges: ElementDefinition[] = visibleFlows
      .filter(f => f?.id && f?.from && f?.to && f?.type) // Guard against malformed flows
      .map((f) => ({
        group: "edges",
        data: {
          id: f.id,
          source: f.from,
          target: f.to,
          label: f.label ?? f.type,
          type: f.type,
          volume: f.volume ?? 10,
          sensitivity: f.sensitivity ?? 0,
          friction: f.friction ?? 0,
          trustGap: f.trustGap ?? 0
        },
        classes: (() => {
          const from = actorById.get(f.from);
          const to = actorById.get(f.to);
          const isCE = (t?: Actor["type"]) => ["Provider","Hospital","Payer","PharmaMfg"].includes(String(t));
          const isBA = (t?: Actor["type"]) => ["PBM","EHRVendor","CRO","CMO","Lab","Pharmacy"].includes(String(t));
          const baaGap = f.type === "data" && (f.sensitivity ?? 0) >= 60 && from && to && isCE(from.type) && isBA(to.type);
          return baaGap ? "baa-gap" : "";
        })()
      }));

    return { nodes, edges };
    } catch (err) {
      console.error("[GraphCanvas] Error computing elements:", err);
      // Return safe fallback with empty edges to prevent crash
      return {
        nodes: actors
          .filter(a => a?.id && a?.name)
          .map((a) => ({
            group: "nodes",
            data: {
              id: a.id,
              label: a.name,
              type: a.type || "Provider",
              trustScore: a.trustScore ?? 50,
              conflictScore: a.conflictScore ?? 50,
              incentives: a.incentives || [],
              liabilities: a.trustLiabilities || [],
              assets: a.dataAssets || [],
              risk: 0
            }
          })),
        edges: []
      };
    }
  }, [actors, flows, filters, scenario]);

  useEffect(() => {
    if (!containerRef.current) return;
    const host = containerRef.current;
    host.style.width = "";
    host.style.height = "";
    host.style.margin = "";

    // Force layout reflow so container has actual dimensions before Cytoscape init
    void host.offsetHeight;

    try {
      // Validate elements before passing to Cytoscape
      const validNodes = elements.nodes.filter(n => n?.data?.id && n?.data?.label);
      const validNodeIds = new Set(validNodes.map(n => n.data.id));
      const validEdges = elements.edges.filter(e => 
        e?.data?.id && 
        e?.data?.source && 
        e?.data?.target &&
        validNodeIds.has(e.data.source) && 
        validNodeIds.has(e.data.target)
      );

      if (validNodes.length === 0) {
        throw new Error("No valid nodes to render");
      }

      const cy = cytoscape({
        container: host,
        elements: [...validNodes, ...validEdges],
        style: [
        {
          selector: "node",
          style: {
            "background-color": (el: NodeSingular) => {
              const t = el.data("type") as Actor["type"];
              return nodeColors[t] ?? "#8b5cf6"; // fallback color
            },
            label: "data(label)",
            color: "#e8eaed",
            "font-size": 10,
            "text-wrap": "wrap",
            "text-max-width": 120,
            "text-background-color": "#0f121a",
            "text-background-opacity": "0.8",
            "text-background-padding": "2",
            "text-outline-width": 1,
            "text-outline-color": "#0b0e16",
            "border-width": (el: NodeSingular) => (Number(el.data("risk") ?? 0) > 0 ? 2 : 1),
            "border-color": (el: NodeSingular) => {
              const r = Number(el.data("risk") ?? 0);
              if (r >= 75) return "#ef4444"; // red
              if (r >= 40) return "#f59e0b"; // amber
              if (r > 0) return "#10b981";   // green
              return "#2a2f45";              // default subtle
            },
            "width": "label",
            "height": "label",
            "padding": "8px"
          } as any
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": (el: EdgeSingular) => {
              const t = el.data("type") as FlowType; return edgeColors[t] ?? "#9ca3af";
            },
            "width": (el: EdgeSingular) =>
              Math.max(2, Math.min(12, 2 + (el.data("volume") ?? 0) / 10)),
            "target-arrow-shape": "triangle",
            "arrow-scale": 1.2,
            "target-arrow-color": (el: EdgeSingular) => {
              const t = el.data("type") as FlowType; return edgeColors[t] ?? "#9ca3af";
            },
            "line-style": (el: EdgeSingular) =>
              (el.data("trustGap") ?? 0) >= 60 ? "dashed" : "solid",
            "opacity": 0.9,
            "label": "data(label)",
            "text-wrap": "wrap",
            "text-max-width": "140",
            "text-background-shape": "roundrectangle",
            "text-border-width": 1,
            "text-border-color": "#000000",
            "text-border-opacity": "0.4",
            color: "#ffffff", // Pure white for maximum contrast
            "font-size": 10,
            "font-weight": "600", // Bold for better readability
            "text-background-color": "#0a0a0f",
            "text-background-opacity": "0.98", // Nearly opaque for strong background
            "text-background-padding": "6", // Extra padding to ensure clearance
            "text-rotation": "autorotate",
            "text-outline-width": 2, // Thicker outline for separation from background
            "text-outline-color": "#000000",
            "text-outline-opacity": "0.9",
            "text-halign": "center", // Horizontally center labels on edge
            "text-valign": "center", // Vertically center labels on edge
            "edge-text-rotation": "autorotate",
            "z-index": 10,
            "min-zoomed-font-size": 6, // Don't render labels if they'd be < 6px
            "text-events": "yes" // Make labels interactable/selectable
          } as any
        },
        
        {
          selector: "edge.baa-gap",
          style: {
            "line-color": "#e879f9",
            "target-arrow-color": "#e879f9",
            "line-style": "dashed",
            "width": 5
          } as any
        },
        {
          selector: "edge.ztl",
          style: {
            "line-color": "#ffffff",
            "target-arrow-color": "#ffffff"
          } as any
        },
        {
          selector: "edge.ztl-money",
          style: {
            // Subtle purple glow/outline without overpowering labels
            "overlay-color": "#a78bfa",
            "overlay-opacity": 0.2
          } as any
        },
        {
          selector: ".blast",
          style: {
            "border-color": "#ff4d4f",
            "border-width": 3,
            "line-color": "#ff4d4f",
            "target-arrow-color": "#ff4d4f",
            "z-index": 20,
            "opacity": 1,
            "overlay-color": "#ff4d4f",
            "overlay-opacity": 0.12
          } as any
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#6ab7ff",
            "line-color": "#6ab7ff",
            "target-arrow-color": "#6ab7ff"
          } as any
        }
        ]
      });

    // Zoom/interaction guardrails
    cy.minZoom(0.05);
    cy.maxZoom(3);
    (cy as any).wheelSensitivity = 0.15;

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        updatingSelectionRef.current = true;
        setSelection(null);
        setTimeout(() => { updatingSelectionRef.current = false; }, 0);
      }
    });
    cy.on("select", "node", (evt) => {
      if (updatingSelectionRef.current) return; // Skip if we're programmatically selecting
      updatingSelectionRef.current = true;
      setSelection({ kind: "actor", id: evt.target.id() });
      setTimeout(() => { updatingSelectionRef.current = false; }, 0);
    });
    cy.on("select", "edge", (evt) => {
      if (updatingSelectionRef.current) return; // Skip if we're programmatically selecting
      updatingSelectionRef.current = true;
      setSelection({ kind: "flow", id: evt.target.id() });
      setTimeout(() => { updatingSelectionRef.current = false; }, 0);
      if (edgeLabelsHoverOnly) {
        try { (evt.target as any).style("label", String(evt.target.data("label") || "")); } catch {}
      }
    });

    // Breach blast radius (Alt/Option-click a node)
    let lastBlast: any = null;
    const clearBlast = () => {
      if (lastBlast) { lastBlast.removeClass("blast"); lastBlast = null; }
    };

    cy.on("tap", "node", (evt) => {
      const ke = (evt as any).originalEvent as MouseEvent | undefined;
      if (ke) ke.preventDefault();
      // Alt-click triggers blast radius visualization; normal clicks proceed to selection
      if (ke?.altKey) {
        clearBlast();
        const start = evt.target;
        const visited = new Set<string>();
        const queue: any[] = [start];
        while (queue.length) {
          const n = queue.shift();
          if (!n || visited.has(n.id())) continue;
          visited.add(n.id());
          // Outgoing data edges with sensitivity >= 60
          const outs = n.outgoers("edge[type = 'data']");
          const hi = outs.filter((e: any) => (e.data("sensitivity") ?? 0) >= 60);
          hi.targets().forEach((t: any) => { if (!visited.has(t.id())) queue.push(t); });
          n.addClass("blast");
          hi.addClass("blast");
          hi.targets().addClass("blast");
        }
        lastBlast = cy.elements(".blast");
      }
    });

    cy.on("tap", "edge", (evt) => {
      const ke = (evt as any).originalEvent as MouseEvent | undefined;
      if (ke) ke.preventDefault();
    });

    cy.on("tap", (evt) => { if (evt.target === cy) clearBlast(); });

    // Hover label handling when hover-only mode is enabled
    cy.on("mouseover", "edge", (evt) => {
      if (!edgeLabelsHoverOnly) return;
      try { (evt.target as any).style("label", String(evt.target.data("label") || "")); } catch {}
    });
    cy.on("mouseout", "edge", (evt) => {
      if (!edgeLabelsHoverOnly) return;
      try {
        if (!(evt.target as any).selected()) {
          (evt.target as any).style("label", "");
        }
      } catch {}
    });

    cy.on("mouseover", "node", (evt) => {
      const d = evt.target.data();
      const renderedPos = (evt.target as any).renderedPosition?.() || { x: 0, y: 0 };
      const rect = (cy.container() as HTMLElement).getBoundingClientRect();
      // Generous tooltip size estimates including padding/content
      const tooltipW = 280; const tooltipH = 160; const pad = 12;
      let x = renderedPos.x + pad;
      let y = renderedPos.y + pad;
      // Flip horizontally/vertically if near right/bottom edges
      if (x + tooltipW > rect.width - pad) x = renderedPos.x - tooltipW - pad;
      if (y + tooltipH > rect.height - pad) y = renderedPos.y - tooltipH - pad;
      // Final clamp within container bounds
      x = Math.max(pad, Math.min(x, rect.width - tooltipW - pad));
      y = Math.max(pad, Math.min(y, rect.height - tooltipH - pad));
      setTooltip({
        x,
        y,
        content: (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              {d.label}
            </div>
            <div className="kv">
              <span className="tag">Trust: {d.trustScore}</span>
              <span className="tag">Conflict: {d.conflictScore}</span>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              <b>Incentives:</b> {d.incentives?.join(", ") || "—"}
            </div>
            <div className="small">
              <b>Liabilities:</b> {d.liabilities?.join(", ") || "—"}
            </div>
            <div className="small">
              <b>Data:</b> {d.assets?.join(", ") || "—"}
            </div>
          </div>
        )
      });
    });
    cy.on("mouseout", "node", () => setTooltip(null));

    cyRef.current = cy;
    try { setCy(cy); } catch {}
    try {
      (window as any).cy = cy;
      (window as any).fitAll = () => { try { cy.fit(undefined, 20); cy.center(); } catch {} };
    } catch {}
    
    // Force immediate resize BEFORE layout to ensure Cytoscape measures the container correctly
    cy.resize();
    
    applyEdgeOffsets(cy);
    runLayoutWithFit(cy, spread);

    // Gentle delayed fit in case initial render raced with layout
    setTimeout(() => { try { cy.resize(); cy.fit(undefined, 20); } catch {} }, 100);

    // Fit whenever the canvas size changes (responsive sidebar stacking, window resize, etc.)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        const c = cyRef.current; if (!c) return;
        requestAnimationFrame(() => { c.resize(); /* no auto-fit to avoid jumping on content changes */ });
      });
      try { ro.observe(host); } catch {}
    }

    return () => {
      try { setCy(null); } catch {}
      cy.destroy();
      cyRef.current = null;
      try { ro?.disconnect(); } catch {}
    };
    } catch (err: any) {
      try { setCy(null); } catch {}
      cyRef.current = null;
      setInitError(err?.message ? String(err.message) : (err ? String(err) : "Failed to initialize graph"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().remove();
      cy.add([...elements.nodes, ...elements.edges]);
      applyEdgeOffsets(cy);
    });
    runLayoutWithFit(cy, spread);
    updateZtlClasses(cy, glowZtlRef.current);
  }, [elements, spread]);

  // React to hover-only label toggle: hide/show labels globally, keep selected visible
  useEffect(() => {
    const cy = cyRef.current; if (!cy) return;
    cy.edges().forEach((e) => { e.style("label", edgeLabelsHoverOnly ? "" : String(e.data("label") || "")); });
    if (edgeLabelsHoverOnly) {
      cy.edges(":selected").forEach((e) => { e.style("label", String(e.data("label") || "")); });
    }
  }, [edgeLabelsHoverOnly]);

  useEffect(() => {
    updateZtlClasses(cyRef.current, glowZTL);
  }, [glowZTL]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    
    // Prevent infinite loop: only update Cytoscape if the selected element differs
    const currentSelected = cy.$(":selected");
    const newId = selection?.id;
    
    if (currentSelected.length === 0 && !newId) return; // nothing to do
    if (currentSelected.length === 1 && currentSelected.id() === newId) return; // already correct
    
    // Set flag to prevent event handlers from re-triggering setSelection
    updatingSelectionRef.current = true;
    cy.elements().unselect();
    if (selection) {
      const el = cy.$id(selection.id);
      if (el.length > 0) el.select();
    }
    setTimeout(() => { updatingSelectionRef.current = false; }, 0);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { selection: currentSel, deleteActor, deleteFlow, saveToLocal } =
        useStore.getState() as any;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveToLocal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.resize(); // do not fit to avoid shifting when side panels change
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      {initError ? (
        <div className="panel">
          <div className="small">
            Canvas failed to initialize. Please reload the page or switch tabs.
          </div>
          <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>{initError}</div>
        </div>
      ) : (
        <div ref={containerRef} className="cytoscape" />
      )}
      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.content}
        </div>
      )}
    </>
  );
}


