import type { Actor, Flow } from "./schema";

// The model's roles that are HIPAA covered entities: health plans and health
// care providers (45 CFR 160.103). A drug maker is not one by default, and
// labs and pharmacies count as providers, not business associates.
const COVERED_ENTITY_TYPES = ["Provider", "Hospital", "Payer"];

// Roles that typically handle PHI on a covered entity's behalf.
const BUSINESS_ASSOCIATE_TYPES = ["PBM", "EHRVendor", "CRO", "CMO"];

export function isCoveredEntity(type?: string): boolean {
  return COVERED_ENTITY_TYPES.includes(String(type));
}

export function isBusinessAssociateRole(type?: string): boolean {
  return BUSINESS_ASSOCIATE_TYPES.includes(String(type));
}

/**
 * A sensitive data flow from a covered entity to a business-associate role
 * with no BAA recorded on the flow. De-identified data is excluded.
 */
export function isBaaGap(flow: Flow, from?: Actor, to?: Actor): boolean {
  return (
    flow.type === "data" &&
    (flow.sensitivity ?? 0) >= 60 &&
    flow.classification !== "De-identified" &&
    flow.legalBasis !== "BAA" &&
    isCoveredEntity(from?.type) &&
    isBusinessAssociateRole(to?.type)
  );
}
