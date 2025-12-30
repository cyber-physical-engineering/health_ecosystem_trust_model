export function interopFactor(kind?: string): number {
  switch (kind) {
    case "FHIR": return 1.25;
    case "EDI_27x":
    case "EDI_835_837": return 1.25;
    case "HL7v2": return 1.15;
    default: return 1.0; // JSON/CSV/undefined
  }
}

export function cadenceFactor(cadence?: string): number {
  if (cadence === "quarterly") return 4;
  if (cadence === "annual") return 2;
  return 1; // ad_hoc/ad-hoc/missing
}

export function safeLog10(x: number): number {
  const n = Number.isFinite(x) ? x : 0;
  return Math.log10(Math.max(10, n));
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function volumeBoost(txCount?: number): number {
  const tx = typeof txCount === "number" && Number.isFinite(txCount) ? txCount : 10_000;
  return safeLog10(tx + 10);
}

export function partyDrag(counterpartyCount?: number): number {
  const c = typeof counterpartyCount === "number" && Number.isFinite(counterpartyCount) ? counterpartyCount : 2;
  return 1 / Math.max(1, c);
}

export function speedToPilotBoost(avgCycleDays?: number, interopKind?: string): number {
  const days = Math.max(1, (typeof avgCycleDays === "number" && Number.isFinite(avgCycleDays) ? avgCycleDays : 30));
  const interop = interopFactor(interopKind ?? "JSON");
  return (1 / (days / 10 + interop)) * 1_000_000;
}

export function speedToPilotScore01(avgCycleDays?: number, interopKind?: string, counterparties?: number): number {
  const days = Math.max(1, (typeof avgCycleDays === "number" && Number.isFinite(avgCycleDays) ? avgCycleDays : 60));
  const cpty = Math.max(1, (typeof counterparties === "number" && Number.isFinite(counterparties) ? counterparties : 2));
  const kind = (interopKind ?? "JSON") as string;
  const interopBonus = (() => {
    if (kind === "CSV" || kind === "JSON") return 1.0;
    if (kind === "HL7v2") return 0.85;
    if (kind === "FHIR") return 0.75;
    if (kind === "EDI_27x" || kind === "EDI_835_837") return 0.65;
    return 1.0;
  })();
  const base = 1 / cpty;
  const timeFactor = 1 / (1 + Math.exp(0.03 * (days - 60)));
  const score = base * timeFactor * interopBonus;
  return clamp(score, 0, 1);
}


