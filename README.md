## Health Ecosystem Trust Model (local)

> **Disclaimer:** This project models economic trust friction and structural incentives based on specific economic theories. It contains illustrative data and is not a technical security audit. See [DISCLAIMER.md](./docs/DISCLAIMER.md) for full details.

Minimal-but-extensible local web app to model relationships and flows in the health ecosystem (providers/payers/manufacturers/regulators/etc.) with editable nodes and edges, persisted locally and import/exportable as JSON.

### Quickstart
- npm i
- npm run dev
- Open http://localhost:3002

### What it does
- Visual graph (Cytoscape) with layout toggle: dagre (default), cose-bilkent
- Actors and flows editable; node tooltips show incentives/liabilities/assets and trust/conflict scores
- Style: node color by actor type; edge color by flow type; width ~ volume; dashed when trustGap ≥ 60
- Filters: flow type chips; sliders for trustGap/sensitivity/friction
- Persist to localStorage; import/export JSON; reset to seed
=
- ZTL insertion points: toggle to glow edges where trustGap ≥ 60 and sensitivity ≥ 60 (money edges get a subtle purple glow)
- Keyboard: Delete selection; Cmd/Ctrl+S save

### Add a new ActorType or FlowType
- Update `src/domain/schema.ts` enums
- Add a color in `src/components/GraphCanvas.tsx` (`nodeColors` or `edgeColors`)
- Optionally seed in `src/domain/seed.ts`

### Export/Import model JSON
- Export: Import/Export tab → Export JSON
- Import: Import/Export tab → Import JSON (validated with Zod; friendly error list if invalid)

### ZTL insertion points
Edges with high trustGap and sensitivity are prime for cryptographic proof to reduce friction. Toggle “ZTL insertion points” in header to visually glow them. Priority list is ROI‑normalized (size‑adjusted) with speed‑to‑pilot boost.

### How data → dollars works
- For each flow we report a single economic value (USD):
  1) `economicValueUSD` (actual or estimated, with `valueBasis` and `valueMethod`),
  2) else `dollarValue` for money flows,
  3) else `unitCount × unitValueUSD` (est.).
- Estimates are clearly labeled “(est.)”. You can disable unit-based estimates with the header toggle.

### Scripts
- npm run dev — start
- npm run build — production build
- npm run preview — preview built app


