export const DEV: boolean = import.meta.env.MODE !== "production";

// Default ON in development, OFF in production unless explicitly set via VITE_FEATURE_NEW_ROI_MATH
const envFlag = (import.meta as any).env?.VITE_FEATURE_NEW_ROI_MATH;
export const FEATURE_NEW_ROI_MATH: boolean =
  typeof envFlag === "string" ? envFlag === "true" : DEV;

// Default narrative for charts/ranking; can be overridden via VITE_DEFAULT_NARRATIVE
const rawNarr = (import.meta as any).env?.VITE_DEFAULT_NARRATIVE as string | undefined;
export type NarrativeDefault = "neutral" | "proof" | "innovation" | "compliance" | "cost";
export const DEFAULT_NARRATIVE: NarrativeDefault =
  (["neutral","proof","innovation","compliance","cost"] as const).includes(rawNarr as any) ? (rawNarr as any) : "neutral";

// Session-scoped override for migration guard
export let SESSION_DEFAULT_NARRATIVE: NarrativeDefault = DEFAULT_NARRATIVE;
export function setSessionDefaultNarrative(v: NarrativeDefault) { SESSION_DEFAULT_NARRATIVE = v; }


