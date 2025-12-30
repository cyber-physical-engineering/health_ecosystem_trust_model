import { describe, it, expect } from "vitest";
import { interopFactor, cadenceFactor, volumeBoost, partyDrag, speedToPilotBoost, clamp, safeLog10 } from "./math";

describe("ROI v2 math", () => {
  it("interop factor mapping", () => {
    expect(interopFactor("FHIR")).toBeCloseTo(1.25);
    expect(interopFactor("EDI_27x")).toBeCloseTo(1.25);
    expect(interopFactor("EDI_835_837")).toBeCloseTo(1.25);
    expect(interopFactor("HL7v2")).toBeCloseTo(1.15);
    expect(interopFactor("JSON")).toBe(1.0);
    expect(interopFactor("CSV")).toBe(1.0);
    expect(interopFactor(undefined)).toBe(1.0);
  });

  it("cadence factor mapping", () => {
    expect(cadenceFactor("quarterly")).toBe(4);
    expect(cadenceFactor("annual")).toBe(2);
    expect(cadenceFactor("ad_hoc")).toBe(1);
    expect(cadenceFactor("ad-hoc" as any)).toBe(1);
    expect(cadenceFactor(undefined)).toBe(1);
  });

  it("raises ROI signals with higher txCount via volumeBoost", () => {
    expect(volumeBoost(1_000)).toBeLessThan(volumeBoost(100_000));
  });

  it("penalizes more counterparties via partyDrag", () => {
    expect(partyDrag(2)).toBeGreaterThan(partyDrag(3));
  });

  it("penalizes longer cycle days via speedToPilotBoost", () => {
    const interop = "JSON";
    expect(speedToPilotBoost(10, interop)).toBeGreaterThan(speedToPilotBoost(40, interop));
  });

  it("safe guards and clamps", () => {
    expect(Number.isFinite(safeLog10(NaN as any))).toBe(true);
    expect(clamp(200000, 25000, 100000)).toBe(100000);
    expect(clamp(10000, 25000, 100000)).toBe(25000);
  });
});


