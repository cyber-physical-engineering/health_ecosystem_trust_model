import { describe, expect, it } from "vitest";
import type { Actor, Flow } from "./schema";
import { isBaaGap } from "./compliance";
import { seedModel as seed } from "./seed";

const actor = (id: string, type: string) => ({ id, name: id, type }) as unknown as Actor;
const dataFlow = (extra: Partial<Flow> = {}) =>
  ({ id: "f1", from: "a", to: "b", type: "data", sensitivity: 80, ...extra }) as unknown as Flow;

describe("isBaaGap", () => {
  const hospital = actor("a", "Hospital");
  const ehrVendor = actor("b", "EHRVendor");

  it("flags sensitive PHI from a covered entity to a business-associate role with no BAA", () => {
    expect(isBaaGap(dataFlow({ classification: "PHI" }), hospital, ehrVendor)).toBe(true);
  });

  it("does not flag a flow that already records a BAA", () => {
    expect(isBaaGap(dataFlow({ classification: "PHI", legalBasis: "BAA" }), hospital, ehrVendor)).toBe(false);
  });

  it("does not flag de-identified data", () => {
    expect(isBaaGap(dataFlow({ classification: "De-identified" }), hospital, ehrVendor)).toBe(false);
  });

  it("does not treat a drug manufacturer as a covered entity", () => {
    expect(isBaaGap(dataFlow(), actor("a", "PharmaMfg"), actor("b", "CRO"))).toBe(false);
  });

  it("does not flag provider-to-lab flows (labs are providers)", () => {
    expect(isBaaGap(dataFlow(), actor("a", "Provider"), actor("b", "Lab"))).toBe(false);
  });

  it("finds no gaps in the shipped seed", () => {
    const byId = new Map(seed.actors.map((a) => [a.id, a]));
    const gaps = seed.flows.filter((f) => isBaaGap(f, byId.get(f.from), byId.get(f.to)));
    expect(gaps).toHaveLength(0);
  });
});
