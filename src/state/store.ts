import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import { Actor, Flow, ModelSchema, STORAGE_KEY, FlowType } from "@domain/schema";
import type { Core } from "cytoscape";
import { seedModel } from "@domain/seed";

type Selection =
  | { kind: "actor"; id: string }
  | { kind: "flow"; id: string }
  | null;

type Filters = {
  flowTypeVisibility: Record<FlowType, boolean>;
  trustGap: [number, number];
  sensitivity: [number, number];
  friction: [number, number];
};

type LayoutMode = "dagre" | "cose-bilkent";
type Scenario = "baseline" | "light" | "strong";

type State = {
  actors: Actor[];
  flows: Flow[];
  selection: Selection;
  selectionHistoryNodeIds: string[]; // last two actor IDs
  filters: Filters;
  layout: LayoutMode;
  glowZTL: boolean;
  scenario: Scenario;
  cy: Core | null;
  spread: 0 | 1 | 2 | 3;
  edgeLabelsHoverOnly: boolean;
  estimateDataDollarToggle: boolean;
  // CRUD
  addActor: () => string;
  updateActor: (id: string, patch: Partial<Actor>) => void;
  deleteActor: (id: string) => void;
  addFlow: (fromId: string, toId: string, type: Flow["type"]) => string | null;
  updateFlow: (id: string, patch: Partial<Flow>) => void;
  deleteFlow: (id: string) => void;
  // selection
  setSelection: (s: Selection) => void;
  // filters
  toggleFlowType: (t: FlowType) => void;
  setFilterRange: (k: "trustGap" | "sensitivity" | "friction", v: [number, number]) => void;
  setLayout: (l: LayoutMode) => void;
  setGlowZTL: (v: boolean) => void;
  setScenario: (v: Scenario) => void;
  setCy: (c: Core | null) => void;
  setSpread: (v: 0 | 1 | 2 | 3) => void;
  setEdgeLabelsHoverOnly: (v: boolean) => void;
  setEstimateDataDollarToggle: (v: boolean) => void;
  // import/export
  saveToLocal: () => void;
  importModel: (json: unknown) => { ok: true } | { ok: false; errors: string[] };
  resetToSeed: () => void;
  rebuildArrows: () => void;
  repairModel: () => void;
  // helpers
  visibleFlows: () => Flow[];
};

const defaultFilters: Filters = {
  flowTypeVisibility: { data: true, money: true, audit: true },
  trustGap: [0, 100],
  sensitivity: [0, 100],
  friction: [0, 100]
};

export const useStore = create<State>()(
  persist(
    (set, get) => {
      return {
      actors: seedModel.actors,
      flows: seedModel.flows,
      selection: null,
      selectionHistoryNodeIds: [],
      filters: defaultFilters,
      layout: "dagre",
      glowZTL: false,
      scenario: "baseline",
      cy: null,
      spread: 1,
      edgeLabelsHoverOnly: false,
      estimateDataDollarToggle: true,

      addActor: () => {
        const id = uuid();
        const actor: Actor = {
          id,
          name: "New Actor",
          type: "Provider",
          notes: "",
          incentives: [],
          trustLiabilities: [],
          dataAssets: [],
          trustScore: 50,
          conflictScore: 50
        };
        set(s => ({ actors: [...s.actors, actor], selection: { kind: "actor", id } }));
        return id;
      },

      updateActor: (id, patch) => {
        set(s => ({ actors: s.actors.map(a => (a.id === id ? { ...a, ...patch } : a)) }));
      },

      deleteActor: (id) => {
        set(s => ({
          actors: s.actors.filter(a => a.id !== id),
          flows: s.flows.filter(f => f.from !== id && f.to !== id),
          selection: null
        }));
      },

      addFlow: (fromId, toId, type) => {
        if (!fromId || !toId) return null;
        const id = uuid();
        const flow: Flow = { id, from: fromId, to: toId, type, label: "", volume: 10, sensitivity: 50, friction: 50, trustGap: 50 };
        set(s => ({ flows: [...s.flows, flow], selection: { kind: "flow", id } }));
        return id;
      },

      updateFlow: (id, patch) => {
        set(s => ({ flows: s.flows.map(f => (f.id === id ? { ...f, ...patch } : f)) }));
      },

      deleteFlow: (id) => {
        set(s => ({ flows: s.flows.filter(f => f.id !== id), selection: null }));
      },

      setSelection: (sel) => {
        set(s => {
          // Deduplicate: don't update if selection is already the same
          if (!sel && !s.selection) return s;
          if (sel && s.selection && sel.kind === s.selection.kind && sel.id === s.selection.id) return s;
          
          if (sel && sel.kind === "actor") {
            const history = [sel.id, ...s.selectionHistoryNodeIds.filter(x => x !== sel.id)].slice(0, 2);
            return { selection: sel, selectionHistoryNodeIds: history };
          }
          return { selection: sel };
        });
      },

      toggleFlowType: (t) => {
        set(s => ({
          filters: {
            ...s.filters,
            flowTypeVisibility: { ...s.filters.flowTypeVisibility, [t]: !s.filters.flowTypeVisibility[t] }
          }
        }));
      },

      setFilterRange: (k, v) => {
        set(s => ({ filters: { ...s.filters, [k]: v } }));
      },

      setLayout: () => set({ layout: "dagre" }),

      setGlowZTL: (v) => set({ glowZTL: v }),

      setScenario: (v) => set({ scenario: v }),

      setCy: (c) => set({ cy: c }),

      setSpread: (v) => set({ spread: v }),

      setEdgeLabelsHoverOnly: (v) => set({ edgeLabelsHoverOnly: v }),

      setEstimateDataDollarToggle: (v) => set({ estimateDataDollarToggle: v }),

      saveToLocal: () => {
        const { actors, flows } = get();
        // Store in the same shape that zustand persist uses
        const toStore = JSON.stringify({ state: { actors, flows }, version: 4 });
        localStorage.setItem(STORAGE_KEY, toStore);
      },

      importModel: (json) => {
        const parsed = ModelSchema.safeParse(json);
        if (!parsed.success) {
          const errors = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
          return { ok: false as const, errors };
        }
        set({ actors: parsed.data.actors, flows: parsed.data.flows, selection: null });
        return { ok: true as const };
      },

      resetToSeed: () => set({ actors: seedModel.actors, flows: seedModel.flows, selection: null }),

      rebuildArrows: () => {
        const s = get();
        const currentActors = s.actors.slice();
        const nameToId = new Map(currentActors.map(a => [a.name, a.id]));
        const typeToId = new Map(currentActors.map(a => [a.type, a.id]));

        // Build seed actor lookups by id -> name/type
        const seedIdToName = new Map(seedModel.actors.map(a => [a.id, a.name]));
        const seedIdToType = new Map(seedModel.actors.map(a => [a.id, a.type]));

        const mapSeedActorIdToCurrent = (seedActorId: string): string | null => {
          const name = seedIdToName.get(seedActorId);
          const type = seedIdToType.get(seedActorId);
          if (name && nameToId.has(name)) return nameToId.get(name)!;
          if (type && typeToId.has(type)) return typeToId.get(type)!;
          return null;
        };

        const rebuilt: Flow[] = [];
        for (const f of seedModel.flows) {
          const fromId = mapSeedActorIdToCurrent(f.from);
          const toId = mapSeedActorIdToCurrent(f.to);
          if (!fromId || !toId) continue;
          rebuilt.push({
            ...f,
            id: uuid(), // new IDs to avoid collisions
            from: fromId,
            to: toId
          });
        }

        // Deduplicate flows by key (from,to,type,label)
        const seen = new Set<string>();
        const deduped = rebuilt.filter(f => {
          const k = `${f.from}|${f.to}|${f.type}|${f.label || ''}`;
          if (seen.has(k)) return false; seen.add(k); return true;
        });

        set({ flows: deduped, selection: null });
        try { const toStore = JSON.stringify({ state: { actors: currentActors, flows: deduped }, version: 4 }); localStorage.setItem(STORAGE_KEY, toStore); } catch {}
      },

      repairModel: () => {
        const s = get();
        const actors = s.actors.slice();
        const flows = s.flows.slice();

        const nameToId = new Map<string, string>(actors.map(a => [a.name, a.id]));
        const typeToId = new Map<string, string>(actors.map(a => [a.type as unknown as string, a.id]));
        const find = (k: string) => nameToId.get(k) || typeToId.get(k) || null;

        const ensure = (fromK: string, toK: string, type: FlowType, label?: string, extras?: Partial<Flow>) => {
          const fromId = find(fromK), toId = find(toK);
          if (!fromId || !toId) return;
          const exists = flows.some(f => f.from === fromId && f.to === toId && f.type === type && (!label || f.label === label));
          if (!exists) flows.push({ id: uuid(), from: fromId, to: toId, type, label: label || "", volume: 10, sensitivity: 50, friction: 50, trustGap: 50, ...(extras || {}) } as Flow);
        };

        // Critical flows
        ensure("PBM","Pharmacy","money","pharmacy reimbursements",{ dollarValue: 18000000, sensitivity: 20, friction: 59, trustGap: 64, volume: 56 });
        ensure("Payer","PBM","money","rebate payments",{ dollarValue: 14000000, sensitivity: 20, friction: 64, trustGap: 69, volume: 60 });
        ensure("PBM","Payer","data","rebate & formulary",{ sensitivity: 52, friction: 71, trustGap: 75, volume: 46 });
        ensure("Provider","Lab","data","orders",{ sensitivity: 61, friction: 41, trustGap: 52, volume: 52 });
        ensure("Lab","Provider","data","results",{ sensitivity: 86, friction: 36, trustGap: 51, volume: 51 });
        ensure("Lab","Payer","data","lab claims",{ sensitivity: 49, friction: 49, trustGap: 55, volume: 41 });
        ensure("Payer","Provider","money","adjudicated payments",{ dollarValue: 68000000, sensitivity: 20, friction: 52, trustGap: 61, volume: 78 });
        ensure("Provider","Payer","data","claims & clinical",{ sensitivity: 72, friction: 66, trustGap: 72, volume: 82 });

        set({ flows, selection: null });
        try { const toStore = JSON.stringify({ state: { actors, flows }, version: 4 }); localStorage.setItem(STORAGE_KEY, toStore); } catch {}
      },

      visibleFlows: () => {
        const { flows, filters, scenario } = get();
        const factor = scenario === "light" ? 0.85 : scenario === "strong" ? 0.6 : 1;
        const [tgMin, tgMax] = filters.trustGap;
        const [sMin, sMax] = filters.sensitivity;
        const [fMin, fMax] = filters.friction;
        return flows
          .map(fl => {
            const tg = fl.trustGap ?? 0;
            const sens = fl.sensitivity ?? 0;
            const eligible = tg >= 60 && sens >= 60;
            const adjTg = Math.round((eligible ? tg * factor : tg));
            return { ...fl, trustGap: adjTg } as Flow;
          })
          .filter(fl =>
          filters.flowTypeVisibility[fl.type] &&
          (fl.trustGap ?? 0) >= tgMin && (fl.trustGap ?? 0) <= tgMax &&
          (fl.sensitivity ?? 0) >= sMin && (fl.sensitivity ?? 0) <= sMax &&
          (fl.friction ?? 0) >= fMin && (fl.friction ?? 0) <= fMax
        );
      }
    };
  },
  {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ actors: s.actors, flows: s.flows, estimateDataDollarToggle: s.estimateDataDollarToggle }),
      version: 4,
      migrate: (persisted: any, _version: number) => {
        try {
          // Comprehensive validation and self-healing
          const actors = Array.isArray(persisted?.actors) ? persisted.actors : [];
          let flows = Array.isArray(persisted?.flows) ? persisted.flows : [];
          
          // Validate actors structure
          if (actors.length === 0 || !actors.every((a: any) => typeof a?.id === "string" && typeof a?.name === "string" && a?.type)) {
            console.warn("[store] Invalid actors in localStorage, resetting to seed");
            return { actors: seedModel.actors, flows: seedModel.flows } as any;
          }
          // Filter out flows that reference missing actors or invalid types
          try {
            const actorIds = new Set(actors.map((a: any) => a?.id).filter((x: any) => typeof x === "string"));
            flows = flows.filter((f: any) => actorIds.has(f?.from) && actorIds.has(f?.to) && ["data","money","audit"].includes(String(f?.type)));
            // Ensure critical ecosystem flows exist by actor name
            const nameToId = new Map<string, string>();
            const typeToId = new Map<string, string>();
            for (const a of actors as any[]) {
              if (a?.name && typeof a.name === "string") nameToId.set(a.name, a.id);
              if (a?.type && typeof a.type === "string") typeToId.set(a.type, a.id);
            }
            const findActorId = (name: string) => nameToId.get(name) || typeToId.get(name) || null;
            const ensure = (fromKey: string, toKey: string, type: FlowType, label?: string, extras?: Partial<Flow>) => {
              const fromId = findActorId(fromKey); const toId = findActorId(toKey);
              if (!fromId || !toId) return;
              const exists = flows.some((f: any) => f?.from === fromId && f?.to === toId && (label ? f?.label === label : true) && f?.type === type);
              if (!exists) {
                flows.push({ id: uuid() as any, from: fromId, to: toId, type, label: label || "", volume: 10, sensitivity: 50, friction: 50, trustGap: 50, ...(extras as any) } as any);
              }
            };
            // Core flows to auto-heal
            ensure("PBM","Pharmacy","money","pharmacy reimbursements", { dollarValue: 18000000 });
            ensure("Payer","PBM","money","rebate payments", { dollarValue: 14000000 });
            ensure("PBM","Payer","data","rebate & formulary", { sensitivity: 52, friction: 71, trustGap: 75, volume: 46 });
            ensure("Provider","Lab","data","orders", { sensitivity: 61, friction: 41, trustGap: 52, volume: 52 });
            ensure("Lab","Provider","data","results", { sensitivity: 86, friction: 36, trustGap: 51, volume: 51 });
            ensure("Lab","Payer","data","lab claims", { sensitivity: 49, friction: 49, trustGap: 55, volume: 41 });
            ensure("Payer","Provider","money","adjudicated payments", { dollarValue: 68000000 });
            ensure("Provider","Payer","data","claims & clinical", { sensitivity: 72, friction: 66, trustGap: 72, volume: 82 });

            // If still too few flows after filtering and auto-heal, fall back to seed
            if (!Array.isArray(flows) || flows.length < 20) {
              console.warn("Persisted flows too few; resetting to seed.");
              return { actors: seedModel.actors, flows: seedModel.flows } as any;
            }
          } catch {}
          return { actors, flows } as any;
        } catch {
          return { actors: seedModel.actors, flows: seedModel.flows } as any;
        }
      }
    }
  )
);


