## Health Ecosystem Expansion Priorities

This is a working plan to broaden the trust map to cover more real-world parties and the highest-value/most-contested relationships. It lists buckets of actors, concrete relationships to add, and a ranked sequence to implement based on trust friction and dollar impact.

### Goals
- Increase coverage of money/data/audit flows with the greatest friction, dispute rates, and dollar magnitude.
- Make latent conflicts of interest and trust gaps visible across care delivery, life sciences manufacturing, and payment.
- Keep modeling extensible: new actor buckets and flow patterns should plug in without schema churn.

---

## Actor Buckets (Additions/Refinements)

- Clinical Care & Operations
  - Provider (individual practices, clinics) — keep separate from Hospital but allow optional grouping
  - Hospital/Health System (IDN), Ambulatory Surgery Centers (ASC)
  - Lab (independent + hospital labs)
  - Pharmacy (retail, specialty)
  - Group Purchasing Organization (GPO)
  - Accreditor (e.g., The Joint Commission)

- Payers & Financial
  - Payer/Insurer (commercial + Medicare Advantage)
  - Reinsurer/Stop-loss
  - Malpractice/Liability Insurer (for providers and hospitals)
  - Financial Institutions (banks), Bondholders
  - Private Equity / Venture Capital / Asset Managers

- Life Sciences & Supply Chain
  - Pharma Manufacturer (can encompass Biotech Mfg unless split is needed)
  - Biotech Manufacturer (optional separate type if different processes/risk)
  - CMO (Contract Manufacturing Organization)
  - CRO (Contract Research Organization)
  - MedTech Manufacturer (devices/diagnostics/capital equipment)
  - Raw Material Supplier (APIs, excipients)
  - Wholesaler/Distributor (pharma & medtech)
  - 3PL/Logistics/Cold Chain

- Digital & Networks
  - EHR Vendor
  - HIE (Health Information Exchange)
  - Clearinghouse (claims)
  - Identity/Consent Provider (IDP/Consent tech)

- Regulators & Standards
  - FDA (drug/device/biologics)
  - CMS (coverage/payment rules), ONC (interoperability), State Boards
  - Auditors/Certification Bodies (GxP, ISO), CAP/CLIA (lab proficiency)

- Patients & Ecosystem
  - Patient/Advocacy Groups
  - Academia/Research Sites

Schema note: reuse existing `ActorType` where possible; add: `Reinsurer`, `MalpracticeInsurer`, `FinancialInstitution`, `PrivateEquity`, `GPO`, `Accreditor`, `Clearinghouse`, `HIE`, `Wholesaler`, `RawMaterialSupplier`, `Logistics`, `Pharmacy`, optionally `BiotechMfg`.

---

## High-Value Relationships (Brainstorm)

Money/Data/Audit arrows indicate common trust tensions. TG = trustGap (0–100); $ = dollar magnitude.

- Provider ↔ Payer
  - Provider → Payer: claims/clinical data (TG high, $ high)
  - Payer → Provider: adjudicated payments, denials (TG high, $ high)

- Payer ↔ PBM ↔ Pharmacy
  - PBM → Payer: rebate/formulary data (TG very high, $ very high)
  - Payer → PBM: payments/contract incentives (TG high, $ very high)
  - PBM → Pharmacy: reimbursement/spread (TG high, $ high)

- Hospital ↔ EHR Vendor
  - Bidirectional data interfaces, uptime/SLA, upgrade audits (TG medium-high, $ medium)

- Lab connections
  - Provider → Lab: orders (data); Lab → Provider: results (data) (TG medium-high re: identity/specimen traceability)
  - Lab → Payer: claims; Lab → Regulators/Accreditors: proficiency/audit (audit)

- Pharma/Biotech/CMO/CRO
  - Pharma ↔ CRO: trial data/audits (TG medium-high, $ medium)
  - Pharma ↔ CMO: tech transfer/specs (data/audit); payments (money) (TG high where chain-of-identity/chain-of-custody matters)
  - RawMaterialSupplier → CMO: batch inputs genealogy (data); audit trails (audit)
  - CMO/Pharma → FDA: submissions, inspections (audit)

- MedTech Manufacturer ↔ Hospital (and GPO)
  - Capital equipment procurement via GPO (money/contracts) (TG medium-high, $ high)
  - UDI data, service logs, safety alerts (data/audit)

- Risk/Assurance Flows
  - Provider/Hospital ↔ Malpractice Insurer: incidents, premiums (money/data) (TG medium-high, $ high)
  - Payer ↔ Reinsurer: risk cessions (money/data) (TG medium, $ high)
  - Hospital ↔ Bondholders/Financial Institutions: covenants, disclosures (data) (TG medium, $ high)

- Networks
  - Provider/Hospital ↔ HIE: encounter data; quality reporting (data) (TG medium)
  - Provider/Payer ↔ Clearinghouse: claim routing/EDI (data) (TG medium)

---

## Prioritized Implementation (Tiers)

### Tier 1 — Highest impact now (trust friction × $ magnitude)
1) Provider ↔ Payer (data/money) — refine labels and weights; denial/appeal paths
2) PBM triangle (PBM ↔ Payer ↔ Pharmacy) — rebates, formulary, spread pricing
3) Hospital ↔ EHR Vendor — interface uptime/upgrade transparency
4) Pharma ↔ CMO ↔ FDA — batch integrity, audit trails, inspections
5) Provider ↔ Lab (orders/results) & Lab ↔ Payer (claims), Lab ↔ Accreditors (proficiency)

### Tier 2 — Financial risk and procurement
6) MedTech Manufacturer ↔ Hospital (capex, UDI, service); include GPO node
7) Provider/Hospital ↔ Malpractice Insurer — premiums vs. incident disclosures
8) Payer ↔ Reinsurer — stop-loss treaties and reporting
9) Hospital ↔ Financial Institutions/Bondholders — covenants, disclosures (for NFP/IDNs)

### Tier 3 — Supply chain & networks
10) RawMaterialSupplier → CMO → Distributor/Wholesaler → Hospital/Pharmacy — CoI/CoC
11) Clearinghouse ↔ Provider/Payer — EDI trust & rejections
12) HIE ↔ Provider/Hospital — identity/consent proofing, data provenance

### Tier 4 — Ownership, incentives, influence
13) Private Equity/VC ↔ Provider/Hospital/MedTech — ownership, incentives, LBO/debt flows
14) Academia/Research ↔ Pharma/CRO — data reuse, IP, publication timing
15) Patient/Advocacy ↔ Payer/Pharma — access programs, outcomes reporting

---

## Concrete Modeling Tasks

- ActorType additions (proposed): `Reinsurer`, `MalpracticeInsurer`, `FinancialInstitution`, `PrivateEquity`, `GPO`, `Accreditor`, `Clearinghouse`, `HIE`, `Wholesaler`, `RawMaterialSupplier`, `Logistics`, `Pharmacy` (optional `BiotechMfg`).
- Seed edges to create immediately (Tier 1):
  - Provider → Payer: claims/clinical (data)
  - Payer → Provider: payments/denials (money)
  - PBM → Payer: rebates & formulary (data)
  - Payer → PBM: rebate payments (money)
  - PBM → Pharmacy: reimbursements (money)
  - Hospital ↔ EHR Vendor: interfaces & upgrades (data)
  - Pharma ↔ CMO: specs/audits (data/audit) and contract payments (money)
  - CMO/Pharma → FDA: inspections/submissions (audit)
  - Provider ↔ Lab: orders/results (data)
  - Lab → Payer: lab claims (data)
  - Lab → Accreditors: proficiency testing (audit)

- Flags and style rules: highlight edges with `trustGap ≥ 60` and `sensitivity ≥ 60` (ZTL insertions); widen lines by `volume`/`dollarValue` for money flows.

---

## Modeling Options: Provider vs Hospital

- Default: keep `Provider` distinct from `Hospital` to reflect different incentives/contracts.
- Option: provide a UI toggle to temporarily group Provider into Hospital for macro views (nodes merged visually; underlying IDs preserved).

---

## Phased Plan (next 3–4 sprints)

Sprint A (Tier 1 core)
- Add PBM triangle edges; add Pharmacy actor; refine Provider–Payer flows & labels.
- Add Lab→Payer & Lab→Accreditor flows; tooltips show traceability risks.

Sprint B (Tier 2 finance/risk)
- Add MalpracticeInsurer, Reinsurer, FinancialInstitution; connect to Provider/Hospital/Payer.
- MedTech↔Hospital (GPO) procurement + UDI/service data flows.

Sprint C (Tier 3 supply-chain/networks)
- Add RawMaterialSupplier, Wholesaler/Distributor, Logistics; connect to CMO/Hospital/Pharmacy.
- Add Clearinghouse, HIE and connect for EDI & exchange.

Sprint D (Tier 4 influence)
- Add PrivateEquity ownership edges and financial flows; Academia/Research ties; Advocacy flows.
- Begin scenario modeling: apply % `trustGap` reduction to selected edges and recompute $-need and dispute-risk.

---

## Metric Roadmap

- Dollar-grounded: add `dollarValue` to money edges; compute top-N $ assurance need.
- Centrality: PageRank/betweenness to find leverage points for proof layers.
- Scenario delta: show ROI estimate after `trustGap` reductions on target edges.

---

## Notes
- FDA vs. CMS: model separately; FDA heavy on audit/submission; CMS heavy on coverage/payment policy.
- Biotech vs. Pharma: start merged; split if specialized biologics manufacturing risk needs separate visuals (chain-of-identity).


