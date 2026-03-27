const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_006";
const CASE_NAME = "MSA Cap Exceedance";

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const updateProcessLog = (processId, logEntry, keyDetailsUpdate = {}) => {
    const processFile = path.join(PUBLIC_DATA_DIR, `process_${processId}.json`);
    let data = { logs: [], keyDetails: {}, sidebarArtifacts: [] };
    if (fs.existsSync(processFile)) data = readJson(processFile);
    if (logEntry) {
        const existingIdx = logEntry.id ? data.logs.findIndex(l => l.id === logEntry.id) : -1;
        if (existingIdx !== -1) { data.logs[existingIdx] = { ...data.logs[existingIdx], ...logEntry }; }
        else { data.logs.push(logEntry); }
    }
    if (keyDetailsUpdate && Object.keys(keyDetailsUpdate).length > 0) {
        data.keyDetails = { ...data.keyDetails, ...keyDetailsUpdate };
    }
    writeJson(processFile, data);
};

const updateProcessListStatus = async (processId, status, currentStatus) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        const response = await fetch(`${apiUrl}/api/update-status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: processId, status, currentStatus })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        try {
            const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(processId));
            if (idx !== -1) { processes[idx].status = status; processes[idx].currentStatus = currentStatus; fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4)); }
        } catch (err) { }
    }
};

const pollHitl = async (processId) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    while (true) {
        try {
            const r = await fetch(`${apiUrl}/hitl/${processId}`);
            const data = await r.json();
            if (!data.pending && data.action) return data.action;
        } catch(e) {}
        await delay(2000);
    }
};

const setHitlPending = async (processId) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        await fetch(`${apiUrl}/hitl/${processId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pending: true })
        });
    } catch(e) {}
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    // ── STAGE 1 STEP A: ServiceNow ticket pickup ────────────────────────────────
    const step1a = {
        id: "step-1a",
        title_p: "Checking ServiceNow queue for assigned tickets...",
        title_s: "ServiceNow ticket INC-2026-05102 picked up — PR-2026-01567, Boehringer Ingelheim, EUR 2,780,000.00",
        reasoning: [
            "Logged into ServiceNow portal (ferring.service-now.com) as Zamp.ai_test",
            "Queried 'My Work' queue — filtered by Assignment Group: Zamp.ai_test",
            "Found 1 new ticket: INC-2026-05102",
            "  Category: Procurement / PR Approval",
            "  Short description: PR-2026-01567 — Boehringer Ingelheim, EUR 2,780,000.00, US/Canada",
            "  Submitted by: Sarah Williams (US R&D Operations)",
            "  Priority: High — high-value biomanufacturing partnership renewal",
            "Opened ticket INC-2026-05102 — extracted PR reference: PR-2026-01567",
            "Updated ticket status: New → In Progress",
            "Initiating PR validation workflow — FPR_006"
        ],
        artifacts: [
            {
                id: "v-snow-6a",
                type: "video",
                label: "ServiceNow: Ticket INC-2026-05102 Pickup",
                videoPath: "/data/servicenow_pickup_fpr006.webm"
            },
            {
                id: "snow-ticket-6",
                type: "json",
                label: "ServiceNow Ticket INC-2026-05102",
                data: {
                    ticket_id: "INC-2026-05102",
                    category: "Procurement / PR Approval",
                    pr_reference: "PR-2026-01567",
                    submitted_by: "Sarah Williams",
                    supplier: "Boehringer Ingelheim",
                    amount: "EUR 2,780,000.00",
                    region: "US/Canada",
                    priority: "High",
                    notes: "Biomanufacturing partnership renewal — MSA validation required",
                    status_before: "New",
                    status_after: "In Progress",
                    assigned_to: "Zamp.ai_test"
                }
            }
        ]
    };

    // ── STAGE 1 STEP B: SAP Ariba PR retrieval ─────────────────────────────────
    const step1b = {
        id: "step-1b",
        title_p: "Authenticating to SAP Ariba and retrieving PR-2026-01567...",
        title_s: "SAP Ariba: PR-2026-01567 opened — Boehringer Ingelheim, EUR 2,780,000.00, 3 line items, 2 attachments",
        reasoning: [
            "Authenticated to SAP Ariba as pace.agent@ferring.com — session established",
            "Navigated to Manage → Purchase Requisitions",
            "Searched PR-2026-01567 — found in pending approvals queue",
            "Opened PR detail view — status: Pending Approval",
            "PR header fields read:",
            "  PR ID: PR-2026-01567 ✓ (matches ServiceNow reference)",
            "  Company Code: 4100 — Ferring Pharmaceuticals Inc.",
            "  Requester: Sarah Williams ✓ (matches ServiceNow submission)",
            "  Budget Owner: Dr. Michael Torres (US Strategic Partnerships)",
            "  PO Owner: US Strategic Sourcing",
            "  Cost Center: CC-US-BIO-007",
            "  Preferred Ordering Method: PORTAL",
            "  Supplier: Boehringer Ingelheim GmbH (Supplier ID: SUP-44219)",
            "  Contract Reference: MSA-BI-2021-0044",
            "  Currency: EUR",
            "  Total Amount: EUR 2,780,000.00 ✓ (matches ServiceNow estimate)",
            "  Region: US/Canada",
            "Clicked Line Items tab — 3 line items found",
            "Clicked Attachments tab — 2 attachments found: MSA + SOW"
        ],
        artifacts: [
            {
                id: "v-ariba-6b",
                type: "video",
                label: "SAP Ariba: PR-2026-01567 Detail View",
                videoPath: "/data/sap_ariba_queue_fpr006.webm"
            },
            {
                id: "pr-header-6",
                type: "json",
                label: "PR-2026-01567 Header Data",
                data: {
                    pr_id: "PR-2026-01567",
                    company_code: "4100",
                    entity: "Ferring Pharmaceuticals Inc.",
                    requester: "Sarah Williams",
                    budget_owner: "Dr. Michael Torres",
                    po_owner: "US Strategic Sourcing",
                    cost_center: "CC-US-BIO-007",
                    preferred_ordering_method: "PORTAL",
                    currency: "EUR",
                    total_amount: "2,780,000.00",
                    supplier: "Boehringer Ingelheim GmbH",
                    supplier_id: "SUP-44219",
                    contract_ref: "MSA-BI-2021-0044",
                    region: "US/Canada",
                    line_items_count: 3,
                    attachments_count: 2,
                    status: "Pending Approval"
                }
            }
        ]
    };

    // ── STAGE 1 STEP C: Line items + supplier enrichment ───────────────────────
    const step1c = {
        id: "step-1c",
        title_p: "Extracting line items and enriching supplier data from Supplier Master...",
        title_s: "3 line items extracted — EUR 2,780,000.00 verified, Boehringer Ingelheim SUP-44219 enriched",
        reasoning: [
            "Line 1: Biomanufacturing Process Development — 12 months × EUR 115,000.00 = EUR 1,380,000.00, MG-BIO-003",
            "Line 2: GMP Manufacturing Scale-Up Support — 6 months × EUR 150,000.00 = EUR 900,000.00, MG-BIO-003",
            "Line 3: Quality Systems & Regulatory Filing — 1 LOT × EUR 500,000.00 = EUR 500,000.00, MG-BIO-003",
            "Sum check: EUR 1,380,000 + EUR 900,000 + EUR 500,000 = EUR 2,780,000.00 ✓ — matches PR header",
            "All 3 lines reference contract MSA-BI-2021-0044",
            "Ship-To: SHIP-US-002 (New Jersey R&D facility), Sold-To: Company Code 4100",
            "Account Type: Cost Center, GL: 67200100 (Biomanufacturing Services)",
            "Supplier Master enrichment: queried Ferring Supplier Master for 'Boehringer Ingelheim'",
            "  Record found: SUP-44219 — Boehringer Ingelheim GmbH, Active",
            "  Registered address: Binger Strasse 173, 55216 Ingelheim am Rhein, Germany",
            "  Ordering method: PORTAL — bi-procurement@boehringer-ingelheim.com",
            "  Payment terms: NET-45",
            "  Purchasing blocks: None — compliant, no flags"
        ],
        artifacts: [
            {
                id: "line-items-6",
                type: "json",
                label: "PR Line Items + Supplier Enrichment",
                data: {
                    line_items: [
                        { line: "1", description: "Biomanufacturing Process Development", qty: "12 months", unit_price: "EUR 115,000.00", total: "EUR 1,380,000.00", material_group: "MG-BIO-003", gl: "67200100" },
                        { line: "2", description: "GMP Manufacturing Scale-Up Support", qty: "6 months", unit_price: "EUR 150,000.00", total: "EUR 900,000.00", material_group: "MG-BIO-003", gl: "67200100" },
                        { line: "3", description: "Quality Systems & Regulatory Filing", qty: "1 LOT", unit_price: "EUR 500,000.00", total: "EUR 500,000.00", material_group: "MG-BIO-003", gl: "67200100" }
                    ],
                    sum_check: "EUR 2,780,000.00 = PR header total ✓",
                    supplier_master: {
                        supplier_id: "SUP-44219",
                        name: "Boehringer Ingelheim GmbH",
                        status: "Active",
                        address: "Binger Strasse 173, 55216 Ingelheim am Rhein, Germany",
                        ordering_method: "PORTAL — bi-procurement@boehringer-ingelheim.com",
                        payment_terms: "NET-45",
                        purchasing_blocks: "None"
                    }
                }
            }
        ]
    };

    // ── STAGE 2 STEP A: Attachment processing ─────────────────────────────────
    const step2a = {
        id: "step-2a",
        title_p: "Processing 2 attachments — classifying and extracting structured data...",
        title_s: "Validation 1/14: 2 documents classified — MSA (conf. 0.97) + SOW (conf. 0.94) — MSA cap data extracted",
        reasoning: [
            "Clicked 'Attachments' tab in PR detail view",
            "Found 2 attachments:",
            "  Attachment 1: MSA_Boehringer_Ingelheim_2021_0044.pdf (52 pages, 1.4MB)",
            "    Classified: Master Service Agreement (confidence: 0.97)",
            "    MSA ID: MSA-BI-2021-0044 | Effective: 2021-07-01 | Renewal: 2026-07-01",
            "    Extracted key clause — Annual service cap: EUR 2,500,000 (Sections 4, 6, 9)",
            "    Cap applies to: all biomanufacturing services including process dev, GMP, regulatory",
            "  Attachment 2: SOW_BI_Biomanufacturing_2026.pdf (22 pages, 980KB)",
            "    Classified: Statement of Work (confidence: 0.94)",
            "    SOW scope confirmed: Biomanufacturing Process Dev + GMP Scale-Up + Regulatory Filing",
            "    Scope matches all 3 PR line items exactly",
            "Cross-check — PR total vs MSA cap:",
            "  PR-2026-01567 total: EUR 2,780,000.00",
            "  MSA-BI-2021-0044 annual cap (Sections 4, 6, 9): EUR 2,500,000.00",
            "  Exceedance: EUR 280,000.00 (+11.2%) — FLAG RAISED",
            "Root cause: Quality Systems & Regulatory Filing LOT (EUR 500,000) not in original MSA budget model",
            "Validation 1/14 — Attachment: PASS (2 docs present, MSA + SOW)",
            "MSA cap exceedance flagged — proceeding to full validation suite"
        ],
        artifacts: [
            {
                id: "pdf-msa-6",
                type: "file",
                label: "MSA — Boehringer Ingelheim (MSA-BI-2021-0044)",
                pdfPath: "/data/boehringer_msa_2021_0044.pdf"
            },
            {
                id: "msa-extracted-6",
                type: "json",
                label: "MSA & SOW Extracted Data",
                data: {
                    msa_id: "MSA-BI-2021-0044",
                    msa_annual_cap: "EUR 2,500,000.00",
                    msa_cap_sections: "Sections 4, 6, 9 — all biomanufacturing services",
                    msa_effective: "2021-07-01",
                    msa_renewal_date: "2026-07-01",
                    sow_scope: "Biomanufacturing Process Dev + GMP Scale-Up + Regulatory Filing — confirmed",
                    pr_total: "EUR 2,780,000.00",
                    cap_exceedance: "EUR 280,000.00",
                    cap_exceedance_pct: "11.2%",
                    root_cause: "Quality Systems & Regulatory Filing LOT (EUR 500,000) not in original MSA budget model",
                    issue: "MSA annual cap exceeded — amendment or executive approval required",
                    "V1_Attachment": "PASS"
                }
            }
        ]
    };

    // ── STAGE 2 STEP B: Full validation suite V2–V14 ──────────────────────────
    const step2b = {
        id: "step-2b",
        title_p: "Running full validation suite — domains 2 through 14...",
        title_s: "Validations 2–14: 12 PASS, 1 FAIL — V7 Pricing fails on MSA cap exceedance — overall: FAIL",
        reasoning: [
            "V2  Accounting: CC-US-BIO-007 valid, GL 67200100 linked to MG-BIO-003 in approved master ✓ PASS",
            "V3  Budget Owner: Dr. Michael Torres ≠ Sarah Williams — segregation of duties confirmed ✓ PASS",
            "V4  Currency: EUR consistent across PR header, all 3 line items, and MSA ✓ PASS",
            "V5  Material Group: MG-BIO-003 approved for biomanufacturing services in GL master ✓ PASS",
            "V6  Supplier ID: 'Boehringer Ingelheim GmbH' — exact match SUP-44219 ✓ PASS",
            "V7  Pricing: FAIL — EUR 2,780,000 exceeds MSA-BI-2021-0044 annual cap EUR 2,500,000 by EUR 280,000 (+11.2%)",
            "V8  Service Type: SAC 998131 (biomanufacturing) — valid for GMP services ✓ PASS",
            "V9  Ordering Method: PORTAL, bi-procurement@boehringer-ingelheim.com — domain verified ✓ PASS",
            "V10 Ship-To: SHIP-US-002 (NJ R&D facility) linked to company code 4100 ✓ PASS",
            "V11 Sold-To: Company code 4100 = Ferring Pharmaceuticals Inc. ✓ PASS",
            "V12 Company Code: Ferring Pharmaceuticals Inc. — confidence 0.99 ✓ PASS",
            "V13 Quantity: All 3 line items match SOW scope individually ✓ PASS",
            "V14 Deliver-To: Ferring Pharmaceuticals Inc., NJ R&D facility — valid ✓ PASS",
            "Note: EUR 2,780,000 > USD 75,000 equivalent — formal RFP ordinarily required",
            "  However: MSA cap exceedance (V7 FAIL) must be resolved before RFP path can apply",
            "  MSA amendment or executive exception is the prerequisite action",
            "Overall result: 13 PASS, 1 FAIL (V7 Pricing / MSA cap) — auto-approval blocked"
        ],
        artifacts: [
            {
                id: "v-ariba-approve-6",
                type: "video",
                label: "SAP Ariba: PR-2026-01567 Validation View",
                videoPath: "/data/sap_ariba_approval_fpr006.webm"
            },
            {
                id: "validation-scorecard-6",
                type: "json",
                label: "Validation Scorecard — 13 PASS, 1 FAIL",
                data: {
                    overall_status: "FAIL",
                    total: 14, passed: 13, failed: 1,
                    results: {
                        "V1 Attachment": "PASS",
                        "V2 Accounting": "PASS",
                        "V3 Budget Owner": "PASS",
                        "V4 Currency": "PASS",
                        "V5 Material Group": "PASS",
                        "V6 Supplier ID": "PASS",
                        "V7 Pricing": "FAIL — EUR 2,780,000 exceeds MSA-BI-2021-0044 annual cap EUR 2,500,000 by EUR 280,000 (+11.2%)",
                        "V8 Service Type": "PASS",
                        "V9 Ordering Method": "PASS",
                        "V10 Ship-To": "PASS",
                        "V11 Sold-To": "PASS",
                        "V12 Company Code": "PASS",
                        "V13 Quantity": "PASS",
                        "V14 Deliver-To": "PASS"
                    },
                    failures: [
                        { check: "V7 Pricing / MSA Cap", result: "FAIL", detail: "PR EUR 2,780,000 exceeds MSA-BI-2021-0044 annual cap EUR 2,500,000 by EUR 280,000 (+11.2%)" }
                    ],
                    rfp_note: "Value > USD 75K equivalent — formal RFP ordinarily required; blocked pending MSA cap resolution first"
                }
            }
        ]
    };

    // ── STAGE 3: Gap analysis + draft email ────────────────────────────────────
    const step3_pre = {
        id: "step-3a",
        title_p: "Overall status: FAIL — generating gap analysis and drafting MSA resolution email...",
        title_s: "Gap analysis complete — EUR 280,000 cap exceedance identified, resolution email drafted to Boehringer Ingelheim",
        reasoning: [
            "Root cause: Quality Systems & Regulatory Filing LOT (EUR 500,000) not included in original MSA-BI-2021-0044 budget model",
            "Options evaluated:",
            "  (a) Reduce scope to fit EUR 2,500,000 cap — would require removing Regulatory Filing LOT entirely",
            "  (b) Execute MSA Amendment raising annual cap — estimated 3-4 weeks",
            "  (c) CFO-level exception approval — expedited ~5 business days",
            "Recommendation: Contact Boehringer Ingelheim to request scope reduction or formal MSA amendment proposal",
            "Note: Formal RFP also required (value > USD 75K equivalent) — but MSA cap must be resolved first",
            "All other 13 validations pass — issue isolated to MSA annual cap",
            "Drafting resolution request email to bi-procurement@boehringer-ingelheim.com",
            "Human approval required before sending — HITL gate"
        ],
        artifacts: [
            {
                id: "gap-analysis-6",
                type: "json",
                label: "Gap Analysis — MSA Cap Exceedance",
                data: {
                    pr_id: "PR-2026-01567",
                    issue: "MSA Annual Cap Exceedance",
                    msa_id: "MSA-BI-2021-0044",
                    msa_cap: "EUR 2,500,000.00",
                    pr_total: "EUR 2,780,000.00",
                    excess: "EUR 280,000.00 (+11.2%)",
                    root_cause: "Quality Systems & Regulatory Filing LOT (EUR 500,000) not in original MSA budget model",
                    additional_flag: "Value > USD 75K — formal RFP required after MSA cap resolved",
                    resolution_options: [
                        "Reduce scope to fit cap (requires revised SOW — removes Regulatory Filing LOT)",
                        "Execute MSA amendment raising annual cap (estimated 3-4 weeks)",
                        "CFO exception approval (~5 business days)"
                    ]
                }
            }
        ]
    };

    // ── STAGE 3 HITL GATE: Email draft awaiting approval ───────────────────────
    const step3_hitl = {
        id: "step-3b",
        title_p: "Drafting email to Boehringer Ingelheim requesting MSA cap resolution...",
        title_s: "Email draft ready — HITL Gate: awaiting procurement approval to send",
        reasoning: [
            "To: bi-procurement@boehringer-ingelheim.com",
            "CC: sarah.williams@ferring.com, dr.michael.torres@ferring.com, legal-contracts@ferring.com, us-strategic-sourcing@ferring.com",
            "Subject: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance — MSA-BI-2021-0044",
            "Email explains the cap calculation: EUR 2,780,000 vs EUR 2,500,000 cap",
            "Identifies Quality Systems & Regulatory Filing LOT (EUR 500,000) as the source of exceedance",
            "Requests formal proposal by 2026-03-31: scope reduction OR MSA amendment",
            "Clearly states: PR-2026-01567 cannot be approved in SAP Ariba until MSA cap is resolved",
            "Human review required before sending — HITL Gate"
        ],
        artifacts: [
            {
                id: "email-draft-6-gate1",
                type: "email_draft",
                label: "Email Draft: MSA Cap Resolution Request to Boehringer Ingelheim",
                data: {
                    isIncoming: false,
                    to: "bi-procurement@boehringer-ingelheim.com",
                    cc: "sarah.williams@ferring.com, dr.michael.torres@ferring.com, legal-contracts@ferring.com, us-strategic-sourcing@ferring.com",
                    subject: "MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance — MSA-BI-2021-0044",
                    body: "Dear Boehringer Ingelheim Procurement Team,\n\nWe are processing Purchase Requisition PR-2026-01567 (EUR 2,780,000.00) for biomanufacturing partnership services under Master Service Agreement MSA-BI-2021-0044.\n\nOur automated validation has identified an MSA annual cap exceedance:\n\n   PR-2026-01567 Total:                     EUR 2,780,000.00\n   MSA-BI-2021-0044 Annual Cap (§4, §6, §9): EUR 2,500,000.00\n   Exceedance:                               EUR   280,000.00 (+11.2%)\n\nThe exceedance relates to the Quality Systems & Regulatory Filing scope (EUR 500,000 LOT) added in the 2026 SOW, which was not included in the original MSA budget model.\n\nTo proceed with this purchase requisition, we require one of the following by 31 March 2026:\n   (a) A revised Statement of Work reducing total scope to EUR 2,500,000 or below, or\n   (b) A formal MSA amendment proposal raising the annual cap to accommodate EUR 2,780,000.\n\nPlease note: PR-2026-01567 cannot be approved in SAP Ariba until this matter is resolved.\n\nWe welcome a call to discuss the most efficient resolution path.\n\nBest regards,\nFerring Pharmaceuticals — US Strategic Sourcing\nus-strategic-sourcing@ferring.com"
                }
            }
        ]
    };

    // ── POST-HITL STAGE 4: Vendor response + re-validation ─────────────────────
    const step4 = {
        id: "step-4",
        title_p: "Monitoring inbox for Boehringer Ingelheim response to MSA cap request...",
        title_s: "Response received — Boehringer Ingelheim proposes MSA Amendment No. 3, scope reduction not viable",
        reasoning: [
            "Email received from bi-procurement@boehringer-ingelheim.com at 11:34 UTC",
            "Subject: RE: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance",
            "Boehringer confirms: 'We acknowledge the EUR 280,000 MSA cap exceedance.'",
            "Boehringer position: 'The Quality Systems & Regulatory Filing scope cannot be reduced — Phase III biomanufacturing protocol mandates the full regulatory filing package.'",
            "Proposed resolution: MSA Amendment No. 3 — raise annual cap EUR 2,500,000 → EUR 2,900,000",
            "Draft amendment attached: MSA_BI_2021_0044_Amendment3_Draft.pdf (10 pages)",
            "Amendment timeline: 10-15 business days (Ferring Legal + CFO signatures required)",
            "Assessment: Scope reduction not viable; MSA Amendment No. 3 is the required path",
            "PR-2026-01567 must be held pending amendment execution",
            "Formal RFP waiver may also be required given value > USD 75K equivalent — to be assessed post-amendment"
        ],
        artifacts: [
            {
                id: "vendor-reply-6",
                type: "email_draft",
                label: "Incoming: Boehringer Ingelheim — MSA Amendment Proposed",
                data: {
                    isIncoming: true,
                    from: "bi-procurement@boehringer-ingelheim.com",
                    to: "us-strategic-sourcing@ferring.com",
                    subject: "RE: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance",
                    body: "Dear Ferring Strategic Sourcing Team,\n\nThank you for your message regarding PR-2026-01567 and the MSA-BI-2021-0044 annual cap.\n\nWe confirm the EUR 280,000 cap exceedance. However, we are unable to reduce the Quality Systems & Regulatory Filing scope below the stated EUR 500,000 LOT. Our Phase III biomanufacturing protocol requires the full regulatory filing package as specified in the 2026 SOW — any reduction would compromise the regulatory submission timeline.\n\nTo resolve this matter, we propose executing MSA Amendment No. 3, which would raise the annual service cap from EUR 2,500,000 to EUR 2,900,000, providing adequate headroom for this engagement and future planning cycles.\n\nWe have attached a draft amendment for Ferring Legal review. Subject to your team's availability, we estimate signature within 10-15 business days.\n\nWe are available for a call this week if that would help expedite.\n\nBest regards,\nBoehringer Ingelheim GmbH — Strategic Procurement\nbi-procurement@boehringer-ingelheim.com"
                }
            },
            {
                id: "resolution-assessment-6",
                type: "json",
                label: "Resolution Assessment",
                data: {
                    vendor_response: "Cannot reduce scope — Quality Systems & Regulatory Filing LOT mandatory for Phase III protocol",
                    proposed_path: "MSA Amendment No. 3: annual cap EUR 2,500,000 → EUR 2,900,000",
                    amendment_timeline: "10-15 business days",
                    draft_attachment: "MSA_BI_2021_0044_Amendment3_Draft.pdf (10 pages)",
                    pr_outcome: "HOLD — resubmit PR-2026-01567 after MSA amendment fully executed",
                    additional_note: "RFP waiver assessment required post-amendment (value > USD 75K equivalent)",
                    next_steps: [
                        "Route MSA Amendment No. 3 draft to Ferring Legal (legal-contracts@ferring.com)",
                        "CFO Office (cfo-office@ferring.com) approval required",
                        "Assess RFP waiver eligibility under revised MSA terms",
                        "Resubmit PR-2026-01567 after amendment signature"
                    ]
                }
            }
        ]
    };

    // ── STAGE 5: ServiceNow update + audit trail ────────────────────────────────
    const step5 = {
        id: "step-5",
        title_p: "Updating ServiceNow ticket INC-2026-05102 and generating audit trail...",
        title_s: "ServiceNow INC-2026-05102 updated — MSA amendment routed to Legal + CFO, PR on hold, process complete",
        reasoning: [
            "Returned to ServiceNow portal (ferring.service-now.com)",
            "Opened ticket INC-2026-05102",
            "Posted work note:",
            "  'PR-2026-01567 — V7 Pricing FAIL. MSA-BI-2021-0044 annual cap EUR 2,500,000 exceeded by EUR 280,000 (+11.2%). Scope reduction not viable per vendor. MSA Amendment No. 3 (cap → EUR 2,900,000) proposed by Boehringer Ingelheim. Draft amendment routed to Ferring Legal and CFO Office. PR on hold pending amendment execution. Estimated 10-15 business days. Ref: FPR_006.'",
            "Updated ticket status: In Progress → Resolved",
            "Resolution code: Procurement — Escalated for MSA contract amendment",
            "Resolution timestamp: 2026-03-27T12:05:00Z",
            "Closure confirmation received",
            "PR-2026-01567 flag set in SAP Ariba: On Hold — Pending MSA Amendment",
            "Process FPR_006 complete",
            "Total agent processing time: ~2m 30s (excluding HITL wait and vendor response time)",
            "Systems accessed: ServiceNow, SAP Ariba",
            "Attachments processed: 2 (MSA + SOW)",
            "Validations run: 14 — 13 passed, 1 failed (V7 Pricing / MSA cap)",
            "HITL gates triggered: 1 (MSA resolution email approval)"
        ],
        artifacts: [
            {
                id: "snow-updated-6",
                type: "json",
                label: "ServiceNow Ticket INC-2026-05102 Updated",
                data: {
                    ticket_id: "INC-2026-05102",
                    status_before: "In Progress",
                    status_after: "Resolved",
                    work_note: "PR-2026-01567 — V7 Pricing FAIL. MSA-BI-2021-0044 cap exceeded by EUR 280,000. MSA Amendment No. 3 proposed by vendor. Draft routed to Legal + CFO. PR on hold pending amendment. Ref: FPR_006.",
                    resolution_code: "Procurement — Escalated for MSA contract amendment",
                    resolved_by: "Pace Automation Agent",
                    timestamp: "2026-03-27T12:05:00Z"
                }
            },
            {
                id: "audit-trail-6",
                type: "json",
                label: "Process Audit Trail",
                data: {
                    process_id: "FPR_006",
                    case_name: "MSA Cap Exceedance",
                    pr_id: "PR-2026-01567",
                    servicenow_ticket: "INC-2026-05102",
                    supplier: "Boehringer Ingelheim GmbH (SUP-44219)",
                    total_amount: "EUR 2,780,000.00",
                    started: "2026-03-27T09:00:00Z",
                    completed: "2026-03-27T12:05:00Z",
                    outcome: "PR ON HOLD — MSA amendment required",
                    systems_accessed: ["ServiceNow", "SAP Ariba"],
                    attachments_processed: 2,
                    validations: { run: 14, passed: 13, failed: 1 },
                    failure_detail: "V7 Pricing — MSA-BI-2021-0044 cap EUR 2,500,000 exceeded by EUR 280,000 (+11.2%)",
                    rfp_note: "Value > USD 75K equivalent — RFP waiver to be assessed post-MSA amendment",
                    hitl_gates: 1,
                    vendor_rounds: 1,
                    msa_amendment_routed: true,
                    ariba_pr_status: "On Hold — Pending MSA Amendment",
                    servicenow_final_status: "Resolved"
                }
            }
        ]
    };

    // ── EXECUTION LOOP ──────────────────────────────────────────────────────────

    // Helper: run a normal step
    const runStep = async (step, isFinal = false) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateProcessLog(PROCESS_ID, { id: step.id, time: timeStr, title: step.title_p, status: 'processing' });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);
        updateProcessLog(PROCESS_ID, {
            id: step.id,
            title: step.title_s,
            status: isFinal ? 'completed' : 'success',
            reasoning: step.reasoning || [],
            artifacts: step.artifacts || []
        });
        await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
        await delay(1500);
    };

    // Helper: run a HITL step — returns false if reviewer halted
    const runHitlStep = async (step, gateLabel) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateProcessLog(PROCESS_ID, { id: step.id, time: timeStr, title: step.title_p, status: 'processing' });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        updateProcessLog(PROCESS_ID, {
            id: step.id,
            title: step.title_s,
            status: 'action-needed',
            reasoning: step.reasoning || [],
            artifacts: step.artifacts || []
        });
        await updateProcessListStatus(PROCESS_ID, 'Needs Attention', gateLabel);
        await setHitlPending(PROCESS_ID);
        const action = await pollHitl(PROCESS_ID);

        if (action === 'approve' || action === 'send') {
            const sentTitle = 'MSA resolution email sent to Boehringer Ingelheim — monitoring inbox for vendor response';
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: sentTitle,
                status: 'success',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'In Progress', sentTitle);
            await delay(1500);
            return true;
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: 'Process halted by reviewer at HITL gate',
                status: 'warning',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted by reviewer at HITL gate');
            return false;
        }
    };

    // Stage 1: ServiceNow pickup + Ariba extraction
    await runStep(step1a);
    await runStep(step1b);
    await runStep(step1c);

    // Stage 2: Attachment processing + full validation suite
    await runStep(step2a);
    await runStep(step2b);

    // Stage 3: Gap analysis + HITL gate (process pauses here on first run)
    await runStep(step3_pre);
    const hitlPassed = await runHitlStep(step3_hitl, 'HITL Gate: MSA Resolution Email Pending Procurement Approval');
    if (!hitlPassed) return;

    // Stage 4: Vendor response (only after HITL approval)
    console.log(`${PROCESS_ID}: Simulating vendor response delay (3s)...`);
    await delay(3000);
    await runStep(step4);

    // Stage 5: ServiceNow update + audit trail
    await runStep(step5, true);

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
