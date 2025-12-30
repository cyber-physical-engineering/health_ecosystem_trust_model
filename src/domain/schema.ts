import { z } from "zod";

export const ActorTypeEnum = z.enum([
  "Provider","Payer","PharmaMfg","MedTech","CRO","CMO",
  "Regulator","Hospital","Lab","EHRVendor","PBM","Patient",
  "Supplier","Distributor","Insurer","Govt","Pharmacy"
]);
export type ActorType = z.infer<typeof ActorTypeEnum>;

export const FlowTypeEnum = z.enum(["data","money","audit"]);
export type FlowType = z.infer<typeof FlowTypeEnum>;

export const ActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: ActorTypeEnum,
  notes: z.string().optional(),
  incentives: z.array(z.string()),
  trustLiabilities: z.array(z.string()),
  dataAssets: z.array(z.string()),
  trustScore: z.number().min(0).max(100),
  conflictScore: z.number().min(0).max(100)
});
export type Actor = z.infer<typeof ActorSchema>;

export const FlowSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: FlowTypeEnum,
  label: z.string().optional(),
  volume: z.number().optional(),
  dollarValue: z.number().optional(),
  sensitivity: z.number().min(0).max(100).optional(),
  friction: z.number().min(0).max(100).optional(),
  trustGap: z.number().min(0).max(100).optional(),
  // Optional legal modeling fields (money flows)
  txCount: z.number().optional(),
  disputeRatePct: z.number().min(0).max(100).optional(),
  litigationRatePct: z.number().min(0).max(100).optional(),
  avgDisputeCostUSD: z.number().optional(),
  avgLitigationCostUSD: z.number().optional(),
  source: z.string().optional(),
  confidence: z.enum(["Low","Medium","High"]).optional(),
  // Unified economic value (optional, non-breaking)
  economicValueUSD: z.number().optional(),
  valueBasis: z.enum(["actual","estimate"]).optional(),
  valueMethod: z.string().optional(),
  unit: z.string().optional(),
  unitCount: z.number().optional(),
  unitValueUSD: z.number().optional(),
  frequency: z.enum(["daily","weekly","monthly","annual"]).optional(),
  linkedFlowId: z.string().optional(),
  // Data/compliance fields (data flows)
  classification: z.enum(["PHI","PII","De-identified"]).optional(),
  legalBasis: z.enum(["BAA","DUA","NDA","Contract"]).optional(),
  retentionDays: z.number().optional(),
  encryptionInTransit: z.boolean().optional(),
  encryptionAtRest: z.boolean().optional(),
  // Finance ops (money flows)
  paymentTermsDays: z.number().optional(),
  dsoDays: z.number().optional(),
  chargebackRatePct: z.number().min(0).max(100).optional(),
  // Audit program (audit flows)
  cadence: z.enum(["ad-hoc","quarterly","annual"]).optional(),
  // Audit scaling factors
  siteCount: z.number().optional(),
  violationRate: z.number().min(0).max(1).optional(),
  // New ROI v2 optional fields
  avgCycleDays: z.number().optional(),
  counterpartyCount: z.number().optional(),
  regExposureWeight: z.number().optional(),
  // Optional alias for cadence; compute will use (auditCadence ?? cadence)
  auditCadence: z.enum(["ad_hoc","quarterly","annual"]).optional(),
  lastAuditDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  findingsOpen: z.number().optional(),
  avgAuditCostUSD: z.number().optional(),
  // Interoperability/standards complexity (primarily for data flows)
  interopComplexity: z.enum(["EDI_27x","EDI_835_837","FHIR","HL7v2","JSON","CSV"]).optional(),
  // New qualitative/economic scale fields
  marketScale: z.enum(["low","medium","high"]).optional(),
  narrativeValue: z.enum(["proof","innovation","compliance","cost"]).optional(),
  // Strategic fit factors
  accessFactor: z.number().optional(),
  referenceabilityFactor: z.number().optional(),
  verticalFitFactor: z.number().optional()
});
export type Flow = z.infer<typeof FlowSchema>;

export const ModelSchema = z.object({
  actors: z.array(ActorSchema),
  flows: z.array(FlowSchema)
});
export type Model = z.infer<typeof ModelSchema>;

export const STORAGE_KEY = "health-ecosys-model@v4";


