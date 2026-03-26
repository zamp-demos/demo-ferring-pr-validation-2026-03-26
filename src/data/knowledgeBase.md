# Ferring Pharmaceuticals - PR to PO Validation Process

## 1. Process Overview

This document defines the automated workflow for processing Purchase Requisitions (PRs) through validation, approval/rejection, and stakeholder communication at Ferring Pharmaceuticals.

The Pace AI agent processes PRs assigned to user 'Zamp.ai_test' in the SAP Ariba pending queue, performing 14 comprehensive validations across business domains.

### Process Flow
1. Regional Queue Management (ServiceNow for US/Canada OR Direct Ariba for India/ROW)
2. Authentication and PR Retrieval via Desktop Agent
3. Data Extraction and Transformation
4. Attachment Processing and Document Identification (Validation 1)
5. Structured Data Extraction from Documents
6. Comprehensive Multi-Domain Validation (Validations 2-14)
7. Automated Action and Communication
8. Human Review (if required)
9. Process Completion and Ticket Update

## 2. Regional Processing

### US/Canada (ServiceNow Flow)
- **Company Codes:** 4100 (Ferring Pharmaceuticals Inc., Parsippany, NJ, USA), 4200 (Ferring Inc., Canada)
- PRs create ServiceNow tickets automatically (1 PR = 1 ticket)
- Desktop agent monitors ServiceNow queue, assigns ticket, extracts PR ID
- Agent uses PR ID to fetch details from SAP Ariba
- Ticket updated throughout: New -> In Progress -> Resolved/Failed

### India/ROW (Direct Ariba Flow)
- **Company Codes:** 1000 (Ferring International Center SA, Saint-Prex, Switzerland), 2100 (Ferring Pharmaceuticals Pvt Ltd, Mumbai, India), 3200 (Ferring GmbH, Kiel, Germany), and 40+ additional codes
- Agent directly accesses SAP Ariba pending approvals queue
- No ServiceNow ticketing involved

## 3. Desktop Agent Capabilities

The Pace desktop agent automates interactions with enterprise systems:
- **SAP Ariba:** Logs in with Ferring credentials, navigates to approval queues, extracts PR data, downloads attachments, posts approval/rejection comments
- **ServiceNow:** Picks up tickets, updates status, posts resolution notes
- All agent actions are logged with timestamps for full audit trail
- Screenshots captured at key decision points

## 4. Validation Domains (14 Total)

### Validation 1: Attachment Validation
- Downloads and validates file types (pdf, doc, docx, txt, xlsx, xls, csv)
- Classifies document type with confidence scoring (threshold: >= 0.8)
- Supported types: SOW, Quotation, Invoice, MSA, PO, Unidentified Document
- Retries up to 3 times if confidence below 0.8

### Validation 2: Accounting Consistency
- Verifies account assignment, account type, sold-to, GL account, WBS, cost centre
- Rules: 'P' = Project, 'K' = Cost Center, 'A' = Asset
- WBS and Cost Centre are mutually exclusive per line item

### Validation 3: Budget Owner
- PO Owner is mandatory; Budget Owner is optional
- Budget Owner and PO Owner must not be identical
- If identical: recommendation to delete Budget Owner

### Validation 4: Currency
- Document currency must match PR line item currency (ISO 4217)
- All PR line items must have consistent currency

### Validation 5: Material Group
- Validates material group + GL account against GL Accounts Master
- Falls back to GL Exception List if not in main master
- Leading '0000' prefix removed from GL account before validation

### Validation 6: Supplier ID
- Fuzzy matching between document and PR supplier names
- Thresholds: >= 90% auto-pass, 60-89% manual review, < 60% fail
- Checks purchasing block, posting block, payment block
- Verifies supplier linked to PR's company code

### Validation 7: Pricing
- Compares sum of (price x quantity) for all PR line items vs document total
- Exact match (0.00 difference): confidence 1.0
- Within 0.01: confidence 0.95
- Greater than 0.01: mismatch, confidence 0.92

### Validation 8: Service Type
- Semantic fuzzy matching with weighted algorithm (40% category, 30% keyword, 20% context, 10% semantic)
- HSN/SAC classification: SAC = 6 digits starting '99', HSN = other
- Overall confidence = (match x 80%) + (code x 15%) + (completeness x 5%)

### Validation 9: Preferred Ordering Method
- For EMAIL/ELECTRONIC: validates supplier email format and domain
- For PRINTING: bypasses email check, flags need for Ferring PO Distribution Group approver
- Email hierarchy: PR comments > Document > Line item > Supplier master

### Validation 10: Ship To
- Must have exactly one distinct Ship-To address per PR
- Ship-To ID must exist in master and link to PR's company code
- Detects special delivery requests in comments

### Validation 11: Sold To
- Sold-to code must exactly equal company code (hard gate)
- Cross-validates entity name and country across master data sources

### Validation 12: Company Code
- Fuzzy matches company name from document against master data
- High confidence (>0.9): auto-pass
- Medium (0.5-0.9): secondary country validation
- Low (<0.5): immediate fail

### Validation 13: Quantity
- Three-level hierarchy: individual line items -> quantity sum -> amount total
- Description similarity >= 60% required for matching
- Level 3 (amount total) only if Level 2 fails

### Validation 14: Deliver To
- Validates delivery_to is not null, empty, N/A, or < 3 characters
- Falls back to ship-to address if delivery_to has issues

## 5. Overall Status Determination
- **FAIL:** Any single validation fails -> Needs Attention
- **MANUAL_REVIEW:** Any validation requires manual review
- **PASS:** All 14 validations pass -> Auto-approved

## 6. Automated Actions
- **PASS:** PR approved in SAP Ariba, reasoning posted as comment
- **FAIL:** Email drafted for human review, PR rejected after email sent
- **MANUAL_REVIEW:** Email drafted, PR status not updated pending human decision

## 7. Email Communication
- Generated for FAIL and MANUAL_REVIEW outcomes
- Recipients: Supplier (invalid document), Requester (validation failures), or Both
- Includes PR ID, detailed issue list, action items, 5-day response deadline
- Default CC: procurement and validation team

## 8. Ferring Company Codes
| Code | Entity | Country |
|------|--------|---------|
| 1000 | Ferring International Center SA | Switzerland |
| 2100 | Ferring Pharmaceuticals Pvt Ltd | India |
| 3200 | Ferring GmbH | Germany |
| 4100 | Ferring Pharmaceuticals Inc. | USA |
| 4200 | Ferring Inc. | Canada |
| 5100 | Ferring Pharmaceuticals A/S | Denmark |
| 6100 | Ferring Pharmaceuticals Co. Ltd | Japan |
| 7100 | Ferring (China) Pharmaceutical Co. | China |

## 9. Common Issues & Resolutions
- **Supplier name mismatch:** Often legal entity vs trade name. Check alias field.
- **Currency mismatch:** Multi-currency PRs require manual review.
- **Missing attachments:** PR moves to Needs Attention. Requester must add documents.
- **MSA cap exceeded:** PR amount above max contract value requires new MSA or amendment.
- **PRINTING ordering method:** Requires manual PO distribution via Ferring PO Distribution Group.
