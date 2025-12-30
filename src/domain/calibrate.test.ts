import { describe, it, expect } from "vitest";
import { seedModel } from "@domain/seed";
import { calibrateCROPharma } from "@domain/calibrate";
import { roiNormalized, roiComposite } from "@domain/roi";

describe("CRO↔Pharma calibration", () => {
  it("raises at least one calibrated edge's ROI (composite) by ≥ 25% and stays idempotent", () => {
    const { actors, flows } = seedModel;
    const beforeRoiById = new Map<string, number>();

    // Identify target edges in seed
    const actorNameById = new Map(actors.map(a => [a.id, a.name] as const));
    const isTarget = (f: any) => {
      const from = (actorNameById.get(f.from) || "") + " ";
      const to = (actorNameById.get(f.to) || "") + " ";
      const a = (from + (actors.find(x => x.id === f.from)?.type || "")).toLowerCase();
      const b = (to + (actors.find(x => x.id === f.to)?.type || "")).toLowerCase();
      const ab = (a.includes("cro") && b.includes("pharmamfg")) || (a.includes("pharmamfg") && b.includes("cro"));
      const label = String(f.label || "").toLowerCase();
      const labOk = label.includes("trial data") || label.includes("sdv") || label.includes("audits");
      return ab && labOk;
    };

    for (const f of flows) {
      if (!isTarget(f)) continue;
      beforeRoiById.set(f.id, roiNormalized(f as any, flows as any));
    }

    const calibrated = calibrateCROPharma(actors as any, flows as any);
    let improvedComposite = 0;
    for (const f of calibrated) {
      if (!beforeRoiById.has(f.id)) continue;
      const afterC = roiComposite(f as any, calibrated as any);
      const beforeC = roiComposite(flows.find(x => x.id === f.id) as any, flows as any);
      if (afterC >= 1.25 * beforeC) improvedComposite++;
    }
    expect(improvedComposite).toBeGreaterThan(0);

    // Idempotency: re-apply should not change results
    const calibrated2 = calibrateCROPharma(actors as any, calibrated as any);
    expect(JSON.stringify(calibrated2)).toBe(JSON.stringify(calibrated));
  });
});


