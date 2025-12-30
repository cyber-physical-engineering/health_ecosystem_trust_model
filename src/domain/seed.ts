import { v4 as uuid } from "uuid";
import type { Actor, Flow } from "./schema";

const A = (name: string, type: Actor["type"], extras?: Partial<Actor>): Actor => ({
  id: uuid(),
  name,
  type,
  trustScore: 60,
  conflictScore: 40,
  incentives: [],
  trustLiabilities: [],
  dataAssets: [],
  ...extras
});

export const seedActors: Actor[] = [
  A("Provider", "Provider", {
    incentives: ["maximize reimbursements","improve outcomes","minimize denials"],
    trustLiabilities: ["prove medical necessity","accurate coding","timely documentation"],
    dataAssets: ["EHR events","claims","clinical notes"],
    trustScore: 57, conflictScore: 43
  }),
  A("Payer", "Payer", {
    incentives: ["cost containment","reduce fraud/waste/abuse","member satisfaction"],
    trustLiabilities: ["timely adjudication","explain denials","prior auth transparency"],
    dataAssets: ["claims","eligibility","utilization mgmt"],
    trustScore: 48, conflictScore: 62
  }),
  A("PharmaMfg", "PharmaMfg", {
    incentives: ["protect IP","ensure quality","expand market access"],
    trustLiabilities: ["prove chain-of-custody","batch integrity","regulatory compliance"],
    dataAssets: ["batch records","stability data","supply chain events"],
    trustScore: 66, conflictScore: 54
  }),
  A("CRO", "CRO", {
    incentives: ["on-time trials","data integrity","cost efficiency"],
    trustLiabilities: ["source data verification","audit readiness","protocol adherence"],
    dataAssets: ["eTMF","EDC","source docs"],
    trustScore: 60, conflictScore: 40
  }),
  A("CMO", "CMO", {
    incentives: ["throughput","yield","quality compliance"],
    trustLiabilities: ["GMP adherence","chain-of-identity","batch genealogy"],
    dataAssets: ["MES","LIMS","batch records"],
    trustScore: 58, conflictScore: 42
  }),
  A("Regulator", "Regulator", {
    incentives: ["public safety","enforce compliance","transparency"],
    trustLiabilities: ["timely inspections","clear guidance","consistency"],
    dataAssets: ["inspection records","guidances","complaints"],
    trustScore: 70, conflictScore: 30
  }),
  A("Hospital", "Hospital", {
    incentives: ["bed utilization","case mix index","quality scores"],
    trustLiabilities: ["credentialing","HIPAA","billing accuracy"],
    dataAssets: ["EHR","ADT","charge master"],
    trustScore: 53, conflictScore: 47
  }),
  A("Lab", "Lab", {
    incentives: ["turnaround time","accuracy","contract volume"],
    trustLiabilities: ["quality control","result traceability"],
    dataAssets: ["LIS","QC logs","results"],
    trustScore: 62, conflictScore: 38
  }),
  A("MedTech", "MedTech", {
    incentives: ["uptime","UDI/traceability","field safety"],
    trustLiabilities: ["device cybersecurity","postmarket surveillance"],
    dataAssets: ["UDI/UDI-DI","telemetry","service logs"],
    trustScore: 58, conflictScore: 42
  }),
  A("EHRVendor", "EHRVendor", {
    incentives: ["market share","interoperability","upsell modules"],
    trustLiabilities: ["data portability","uptime","security"],
    dataAssets: ["APIs","audit logs","schema"],
    trustScore: 49, conflictScore: 51
  }),
  A("PBM", "PBM", {
    incentives: ["rebates","formulary control","spread"],
    trustLiabilities: ["rebate transparency","conflict disclosure"],
    dataAssets: ["claims","formularies","rebate contracts"],
    trustScore: 43, conflictScore: 67
  }),
  A("Pharmacy", "Pharmacy", {
    incentives: ["on-time fill","reimbursement","inventory turns"],
    trustLiabilities: ["claim accuracy","dispense record integrity"],
    dataAssets: ["dispense logs","NDC/UDI","inventory"],
    trustScore: 55, conflictScore: 45
  }),
  A("Patient", "Patient", {
    incentives: ["access","privacy","affordability"],
    trustLiabilities: ["consent management","identity verification"],
    dataAssets: ["PHI","wearables","consents"],
    trustScore: 50, conflictScore: 20
  })
];

const idByName = Object.fromEntries(seedActors.map(a => [a.name, a.id]));

const F = (fromName: string, toName: string, type: Flow["type"], extras?: Partial<Flow>): Flow => ({
  id: uuid(),
  from: idByName[fromName],
  to: idByName[toName],
  type,
  ...extras
});

// Construct flows with cross-links
const flows: Flow[] = [];

// Core claims and payments
const claimsDataFlow = F("Provider","Payer","data", {
  label: "claims & clinical",
  sensitivity: 72, friction: 66, trustGap: 72, volume: 82,
  source: "internal:RCM", confidence: "Medium",
  unit: "claim", unitCount: 3500000, unitValueUSD: 12,
  economicValueUSD: 42000000, valueBasis: "estimate",
  valueMethod: "$12/claim × 3.5M claims/yr", frequency: "annual",
  interopComplexity: "EDI_835_837",
  counterpartyCount: 3, avgCycleDays: 120,
  narrativeValue: "compliance",
  accessFactor: 0.98, referenceabilityFactor: 1.00, verticalFitFactor: 1.00,
  classification: "PHI", legalBasis: "BAA", encryptionInTransit: true, encryptionAtRest: true, retentionDays: 365
});
flows.push(claimsDataFlow);

flows.push(F("Provider","Payer","money", {
  label: "reimbursements", sensitivity: 25, friction: 57, trustGap: 62, volume: 70,
  dollarValue: 42000000, source: "finance:FY24", confidence: "Medium",
  paymentTermsDays: 30, dsoDays: 38,
  counterpartyCount: 3, avgCycleDays: 120,
  narrativeValue: "cost",
  accessFactor: 0.95, referenceabilityFactor: 0.98, verticalFitFactor: 0.95
}));

flows.push(F("PharmaMfg","CRO","data", { label:"trial data", sensitivity: 82, friction: 38, trustGap: 36, volume: 54, source: "qa:studies", confidence: "Low", classification: "PII", legalBasis: "Contract", encryptionInTransit: true, interopComplexity: "JSON", counterpartyCount: 2, avgCycleDays: 60, narrativeValue: "innovation", accessFactor: 1.05, referenceabilityFactor: 1.05, verticalFitFactor: 1.05 }));
flows.push(F("PharmaMfg","CRO","audit", { label:"SDV & audits", sensitivity: 76, friction: 48, trustGap: 44, volume: 30, source: "qa:audit-log", confidence: "Low", cadence: "annual", findingsOpen: 2, avgAuditCostUSD: 30000, siteCount: 2, violationRate: 0.05, narrativeValue: "compliance", accessFactor: 1.05, referenceabilityFactor: 1.05, verticalFitFactor: 1.10 }));
flows.push(F("PharmaMfg","CMO","data", { label:"batch specs", sensitivity: 66, friction: 34, trustGap: 42, volume: 42, classification: "De-identified", interopComplexity: "JSON", counterpartyCount: 2, avgCycleDays: 60, narrativeValue: "compliance", accessFactor: 1.08, referenceabilityFactor: 1.04, verticalFitFactor: 1.05 }));
flows.push(F("PharmaMfg","CMO","audit", { label:"GMP audits", sensitivity: 60, friction: 56, trustGap: 56, volume: 24, source: "gmp:audit", confidence: "Medium", cadence: "annual", findingsOpen: 3, avgAuditCostUSD: 80000, siteCount: 3, violationRate: 0.10, narrativeValue: "compliance", accessFactor: 1.10, referenceabilityFactor: 1.05, verticalFitFactor: 1.10 }));
flows.push(F("PharmaMfg","CMO","money", { label:"contract payments", sensitivity: 15, friction: 28, trustGap: 24, volume: 28, dollarValue: 6500000, txCount: 120, disputeRatePct: 5.0, litigationRatePct: 1.0, avgDisputeCostUSD: 4500, avgLitigationCostUSD: 90000, source: "contracts:CMO", confidence: "Medium", paymentTermsDays: 45, counterpartyCount: 2, avgCycleDays: 45, regExposureWeight: 1.3, narrativeValue: "cost", accessFactor: 1.10, referenceabilityFactor: 1.05, verticalFitFactor: 1.05 }));
flows.push(F("Hospital","EHRVendor","data", { label:"EHR events", sensitivity: 85, friction: 31, trustGap: 52, volume: 92, classification: "PHI", legalBasis: "BAA", encryptionInTransit: true, encryptionAtRest: true, interopComplexity: "HL7v2", counterpartyCount: 2, avgCycleDays: 90, narrativeValue: "innovation" }));
flows.push(F("EHRVendor","Hospital","data", { label:"interfaces & upgrades", sensitivity: 38, friction: 46, trustGap: 56, volume: 36, counterpartyCount: 2, avgCycleDays: 75, narrativeValue: "innovation" }));

const adjudicatedPaymentsFlow = F("Payer","Provider","money", {
  label:"adjudicated payments", sensitivity: 20, friction: 52, trustGap: 61, volume: 78,
  dollarValue: 68000000, txCount: 1200000, disputeRatePct: 2.0, litigationRatePct: 0.2, avgDisputeCostUSD: 120, avgLitigationCostUSD: 50000,
  counterpartyCount: 2, avgCycleDays: 15, regExposureWeight: 1.0,
  source: "finance:FY24", confidence: "Medium", paymentTermsDays: 30, dsoDays: 18,
  narrativeValue: "cost"
});
flows.push(adjudicatedPaymentsFlow);

// Link claims to adjudicated payments
claimsDataFlow.linkedFlowId = adjudicatedPaymentsFlow.id;
adjudicatedPaymentsFlow.linkedFlowId = claimsDataFlow.id;

flows.push(F("Regulator","PharmaMfg","audit", { label:"FDA cGMP inspections", sensitivity: 70, friction: 60, trustGap: 66, volume: 20, source: "reg:inspections", confidence: "Low", cadence: "annual", findingsOpen: 1, avgAuditCostUSD: 75000, siteCount: 2, violationRate: 0.06, narrativeValue: "compliance" }));
flows.push(F("PBM","Payer","data", { label:"rebate & formulary", sensitivity: 52, friction: 71, trustGap: 75, volume: 46, interopComplexity: "JSON", narrativeValue: "compliance" }));

// Phase 1 additions
flows.push(F("Payer","PBM","money", { label:"rebate payments", sensitivity: 20, friction: 64, trustGap: 69, volume: 60, dollarValue: 14000000, txCount: 12000, disputeRatePct: 3.0, litigationRatePct: 0.3, avgDisputeCostUSD: 400, avgLitigationCostUSD: 75000, source: "trade:FY24", confidence: "Low", paymentTermsDays: 60, counterpartyCount: 3, avgCycleDays: 7, narrativeValue: "cost" }));
flows.push(F("PBM","Pharmacy","money", { label:"pharmacy reimbursements", sensitivity: 20, friction: 59, trustGap: 64, volume: 56, dollarValue: 18000000, txCount: 2500000, disputeRatePct: 0.8, litigationRatePct: 0.05, avgDisputeCostUSD: 45, avgLitigationCostUSD: 35000, source: "network:FY24", confidence: "Low", paymentTermsDays: 15, counterpartyCount: 2, avgCycleDays: 5, narrativeValue: "cost" }));
flows.push(F("Provider","Lab","data", { label:"orders", sensitivity: 61, friction: 41, trustGap: 52, volume: 52, unit: "order", unitCount: 1000000, unitValueUSD: 5, economicValueUSD: 5000000, valueBasis: "estimate", valueMethod: "$5/order × 1.0M/yr", frequency: "annual", classification: "PHI", legalBasis: "BAA", interopComplexity: "HL7v2", counterpartyCount: 2, avgCycleDays: 90, narrativeValue: "proof" }));
flows.push(F("Lab","Provider","data", { label:"results", sensitivity: 86, friction: 36, trustGap: 51, volume: 51, unit: "result", unitCount: 1000000, unitValueUSD: 5, economicValueUSD: 5000000, valueBasis: "estimate", valueMethod: "$5/result × 1.0M/yr", frequency: "annual", classification: "PHI", legalBasis: "BAA", interopComplexity: "HL7v2", counterpartyCount: 2, avgCycleDays: 90, narrativeValue: "compliance" }));
flows.push(F("Lab","Payer","data", { label:"lab claims", sensitivity: 49, friction: 49, trustGap: 55, volume: 41, unit: "claim", unitCount: 1100000, unitValueUSD: 5, economicValueUSD: 5500000, valueBasis: "estimate", valueMethod: "$5/claim × 1.1M/yr", frequency: "annual", counterpartyCount: 3, avgCycleDays: 120, narrativeValue: "compliance" }));
flows.push(F("Patient","Provider","data", { label:"consents & PHI", sensitivity: 90, friction: 35, trustGap: 55, volume: 26, classification: "PHI", counterpartyCount: 2, avgCycleDays: 60, narrativeValue: "proof" }));

// Additional money flows with dollar grounding
flows.push(F("Hospital","EHRVendor","money", { label:"license & maintenance fees", sensitivity: 10, friction: 39, trustGap: 46, volume: 35, dollarValue: 2400000, txCount: 50, disputeRatePct: 10.0, litigationRatePct: 1.0, avgDisputeCostUSD: 5000, avgLitigationCostUSD: 150000, source: "contracts:EHR", confidence: "Low", paymentTermsDays: 30, counterpartyCount: 2, avgCycleDays: 90, narrativeValue: "cost" }));
flows.push(F("Payer","Lab","money", { label:"lab reimbursements", sensitivity: 15, friction: 48, trustGap: 54, volume: 31, dollarValue: 7500000, txCount: 220000, disputeRatePct: 1.2, litigationRatePct: 0.1, avgDisputeCostUSD: 80, avgLitigationCostUSD: 40000, source: "finance:FY24", confidence: "Low", paymentTermsDays: 30, counterpartyCount: 3, avgCycleDays: 120, narrativeValue: "cost" }));

// Additional audit flows to balance non-pharma oversight
const postPaymentAudit = F("Payer","Provider","audit", { label:"post-payment audits", sensitivity: 62, friction: 70, trustGap: 75, volume: 21, source: "siu:audits", confidence: "Low", cadence: "ad-hoc", findingsOpen: 3, avgAuditCostUSD: 60000, siteCount: 3, violationRate: 0.08, narrativeValue: "compliance" });
postPaymentAudit.linkedFlowId = adjudicatedPaymentsFlow.id;
flows.push(postPaymentAudit);

flows.push(F("Regulator","Hospital","audit", { label:"CMS/state hospital inspections", sensitivity: 71, friction: 55, trustGap: 61, volume: 15, source: "reg:hospital", confidence: "Low", cadence: "annual", findingsOpen: 1, avgAuditCostUSD: 50000, siteCount: 2, violationRate: 0.05, narrativeValue: "compliance" }));

// MedTech integrations
flows.push(F("Hospital","MedTech","money", { label:"device service & maintenance fees", sensitivity: 10, friction: 39, trustGap: 48, volume: 22, dollarValue: 1800000, txCount: 120, disputeRatePct: 2.0, litigationRatePct: 0.2, avgDisputeCostUSD: 4000, avgLitigationCostUSD: 90000, source: "biomed:contracts", confidence: "Low", paymentTermsDays: 30, counterpartyCount: 2, avgCycleDays: 75, narrativeValue: "cost" }));
flows.push(F("MedTech","Hospital","data", { label:"UDI / device telemetry", sensitivity: 68, friction: 44, trustGap: 62, volume: 40, source: "devices:telemetry", confidence: "Low", interopComplexity: "JSON", counterpartyCount: 2, avgCycleDays: 60, narrativeValue: "innovation" }));
flows.push(F("Lab","MedTech","data", { label:"analyzer QC & firmware", sensitivity: 45, friction: 36, trustGap: 50, volume: 28, source: "lab:QC", confidence: "Low", interopComplexity: "JSON", counterpartyCount: 2, avgCycleDays: 60, narrativeValue: "innovation" }));
flows.push(F("Regulator","MedTech","audit", { label:"FDA device inspections (QSR)", sensitivity: 66, friction: 58, trustGap: 65, volume: 14, source: "reg:medtech", confidence: "Low", cadence: "annual", siteCount: 1, violationRate: 0.04, narrativeValue: "compliance" }));

// Targeted additions requested
const priorAuthReq = F("Provider","Payer","data", { label:"prior auth requests", sensitivity: 70, friction: 65, trustGap: 68, volume: 58, classification: "PHI", legalBasis: "BAA", encryptionInTransit: true, encryptionAtRest: true, retentionDays: 365, interopComplexity: "EDI_27x", counterpartyCount: 3, avgCycleDays: 120, narrativeValue: "compliance" });
const priorAuthDec = F("Payer","Provider","data", { label:"prior auth decisions", sensitivity: 70, friction: 55, trustGap: 60, volume: 58, classification: "PHI", legalBasis: "BAA", encryptionInTransit: true, encryptionAtRest: true, retentionDays: 365, interopComplexity: "FHIR", counterpartyCount: 3, avgCycleDays: 90, narrativeValue: "innovation" });
priorAuthReq.linkedFlowId = priorAuthDec.id;
priorAuthDec.linkedFlowId = priorAuthReq.id;
flows.push(priorAuthReq);
flows.push(priorAuthDec);

flows.push(F("Provider","Payer","data", { label:"appeals & supporting docs", sensitivity: 78, friction: 72, trustGap: 72, volume: 30, classification: "PHI", legalBasis: "BAA", encryptionInTransit: true, encryptionAtRest: true, counterpartyCount: 3, avgCycleDays: 150, narrativeValue: "compliance" }));
flows.push(F("Pharmacy","PBM","data", { label:"pharmacy claims", sensitivity: 65, friction: 50, trustGap: 62, volume: 70, classification: "PHI", legalBasis: "BAA", encryptionInTransit: true, unit: "claim", unitCount: 2200000, unitValueUSD: 6, economicValueUSD: 13200000, valueBasis: "estimate", frequency: "annual", interopComplexity: "EDI_835_837", counterpartyCount: 3, avgCycleDays: 120, narrativeValue: "proof" }));

const mfrRebates = F("PharmaMfg","PBM","money", { label:"rebate dollars", sensitivity: 15, friction: 40, trustGap: 55, volume: 36, dollarValue: 20000000, txCount: 240, disputeRatePct: 2.0, litigationRatePct: 0.2, avgDisputeCostUSD: 10000, avgLitigationCostUSD: 120000, source: "contracts:rebates", confidence: "Low", paymentTermsDays: 60, chargebackRatePct: 1.0, counterpartyCount: 3, avgCycleDays: 10, narrativeValue: "cost" });
const rebateAdj = F("PBM","PharmaMfg","data", { label:"rebate adjudication reports", sensitivity: 30, friction: 42, trustGap: 58, volume: 24 });
mfrRebates.linkedFlowId = rebateAdj.id;
rebateAdj.linkedFlowId = mfrRebates.id;
flows.push(mfrRebates);
flows.push(rebateAdj);

flows.push(F("Patient","Provider","money", { label:"copays", sensitivity: 10, friction: 25, trustGap: 35, volume: 40, dollarValue: 5000000, txCount: 800000, disputeRatePct: 0.3, litigationRatePct: 0.02, avgDisputeCostUSD: 20, avgLitigationCostUSD: 20000, counterpartyCount: 2, avgCycleDays: 60, narrativeValue: "cost" }));
flows.push(F("Regulator","Lab","audit", { label:"CLIA inspections", sensitivity: 65, friction: 50, trustGap: 60, volume: 12, cadence: "annual", findingsOpen: 1, avgAuditCostUSD: 50000, siteCount: 1, violationRate: 0.03, narrativeValue: "compliance" }));

export const seedFlows: Flow[] = flows;

export const seedModel = { actors: seedActors, flows: seedFlows };


