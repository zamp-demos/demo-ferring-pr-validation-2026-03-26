const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_006";
const CASE_NAME = "Full Pace Capabilities Showcase";

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

    // ── STAGE 1: ServiceNow queue pickup ──────────────────────────────────────
    const step1 = {
        id: "step-1",
        title_p: "Checking ServiceNow queue for assigned tickets...",
        title_s: "ServiceNow ticket INC-2026-05102 picked up — PR-2026-01567, Boehringer Ingelheim, EUR 2,780,000.00",
        reasoning: [
            "Logged into ServiceNow portal (ferring.service-now.com) as Zamp.ai_test",
            "Queried 'My Work' queue — filtered by Assignment Group: Zamp.ai_test",
            "Found 1 new ticket: INC-2026-05102",
            "  Category: Procurement / PR Approval",
            "  Short description: PR-2026-01567 — Boehringer Ingelheim, EUR 2,780,000.00, US/Canada, MSA validation required",
            "  Submitted by: Dr. Robert Kingsley (US R&D Operations)",
            "  Priority: High — high-value contract renewal",
            "Opened ticket INC-2026-05102 — extracted PR reference: PR-2026-01567",
            "Updated ticket status: New → In Progress",
            "Initiating comprehensive PR validation workflow — FPR_006"
        ],
        artifacts: [
            {
                id: "v-snow-6",
                type: "video",
                label: "ServiceNow: Ticket INC-2026-05102 Pickup",
                videoPath: "/data/servicenow_fpr006.webm"
            },
            {
                id: "snow-ticket-6",
                type: "json",
                label: "ServiceNow Ticket INC-2026-05102",
                data: {
                    ticket_id: "INC-2026-05102",
                    category: "Procurement / PR Approval",
                    pr_reference: "PR-2026-01567",
                    submitted_by: "Dr. Robert Kingsley",
                    supplier: "Boehringer Ingelheim",
                    amount: "EUR 2,780,000.00",
                    region: "US/Canada",
                    priority: "High",
                    notes: "MSA cap validation required — contract renewal",
                    status_before: "New",
                    status_after: "In Progress",
                    assigned_to: "Zamp.ai_test"
                }
            }
        ]
    };

    // ── STAGE 2: Authentication and PR retrieval ──────────────────────────────
    const step2 = {
        id: "step-2",
        title_p: "Authenticating to SAP Ariba and retrieving PR details...",
        title_s: "Connected to SAP Ariba — PR-2026-01567 opened, Boehringer Ingelheim, EUR 2,780,000.00",
        reasoning: [
            "Authenticated to SAP Ariba as pace.agent@ferring.com",
            "Session established — navigated to Manage → Purchase Requisitions",
            "Searched PR-2026-01567 — found in pending approvals queue",
            "Opened PR detail view",
            "PR header fields read:",
            "  PR ID: PR-2026-01567 ✓ (matches ServiceNow reference)",
            "  Company Code: 4100 — Ferring Pharmaceuticals Inc.",
            "  Requester: Dr. Robert Kingsley ✓ (matches ServiceNow)",
            "  Budget Owner: Sarah Whitfield (US Contract Management)",
            "  PO Owner: US Strategic Sourcing",
            "  Cost Center: CC-US-RD-003",
            "  Supplier: Boehringer Ingelheim GmbH (Supplier ID: SUP-44219)",
            "  Contract Reference: MSA-BI-2021-0044",
            "  Currency: EUR",
            "  Total Amount: EUR 2,780,000.00 ✓ (matches ServiceNow)",
            "  Region: US/Canada"
        ],
        artifacts: [
            {
                id: "v-ariba-6",
                type: "video",
                label: "SAP Ariba: PR-2026-01567 Detail View",
                videoPath: "/data/sap_ariba_desktop_agent_fpr006.webm"
            },
            {
                id: "pr-header-6",
                type: "json",
                label: "PR-2026-01567 Header",
                data: {
                    pr_id: "PR-2026-01567",
                    company_code: "4100",
                    entity: "Ferring Pharmaceuticals Inc.",
                    requester: "Dr. Robert Kingsley",
                    budget_owner: "Sarah Whitfield",
                    po_owner: "US Strategic Sourcing",
                    cost_center: "CC-US-RD-003",
                    currency: "EUR",
                    total_amount: "2,780,000.00",
                    supplier: "Boehringer Ingelheim GmbH",
                    supplier_id: "SUP-44219",
                    contract_ref: "MSA-BI-2021-0044",
                    region: "US/Canada",
                    line_items_count: 3
                }
            }
        ]
    };

    // ── STAGE 3: Data extraction and supplier enrichment ──────────────────────
    const step3 = {
        id: "step-3",
        title_p: "Extracting PR data — header fields, line items, and supplier enrichment...",
        title_s: "3 line items extracted — EUR 2,780,000.00 total, Boehringer Ingelheim enriched via Supplier Master",
        reasoning: [
            "Clicked 'Line Items' tab in PR detail view",
            "Line 1: Phase II Clinical Trial Management — 12 months × EUR 150,000.00 = EUR 1,800,000.00",
            "Line 2: Regulatory Affairs Support — 12 months × EUR 50,000.00 = EUR 600,000.00",
            "Line 3: Data Management & Biostatistics — 1 LOT × EUR 380,000.00 = EUR 380,000.00",
            "Sum: EUR 1,800,000 + EUR 600,000 + EUR 380,000 = EUR 2,780,000.00 ✓ — matches PR header",
            "All 3 lines reference contract MSA-BI-2021-0044",
            "Supplier Master enrichment: searched Ferring Supplier Master for 'Boehringer Ingelheim'",
            "  Record found: SUP-44219 — Boehringer Ingelheim GmbH, Active, EMEA",
            "  Registered address: Binger Strasse 173, 55216 Ingelheim am Rhein, Germany",
            "  Ordering method: PORTAL — bi-procurement@boehringer-ingelheim.com",
            "  Payment terms: NET-45",
            "  Supplier status: Active — no purchasing blocks, compliant"
        ],
        artifacts: [
            {
                id: "line-items-6",
                type: "json",
                label: "PR Line Items + Supplier Enrichment",
                data: {
                    line_items: [
                        { line: "1", description: "Phase II Clinical Trial Management", qty: "12 months", unit_price: "EUR 150,000.00", total: "EUR 1,800,000.00" },
                        { line: "2", description: "Regulatory Affairs Support", qty: "12 months", unit_price: "EUR 50,000.00", total: "EUR 600,000.00" },
                        { line: "3", description: "Data Management & Biostatistics", qty: "1 LOT", unit_price: "EUR 380,000.00", total: "EUR 380,000.00" }
                    ],
                    sum_check: "EUR 2,780,000.00 = PR header total ✓",
                    supplier_master: {
                        supplier_id: "SUP-44219",
                        name: "Boehringer Ingelheim GmbH",
                        status: "Active",
                        region: "EMEA",
                        address: "Binger Strasse 173, 55216 Ingelheim am Rhein, Germany",
                        ordering_method: "PORTAL — bi-procurement@boehringer-ingelheim.com",
                        payment_terms: "NET-45",
                        purchasing_blocks: "None",
                        registration_date: "2018-04-12"
                    }
                }
            }
        ]
    };

    // ── STAGE 4: Attachment processing (Validation 1/14) ─────────────────────
    const step4 = {
        id: "step-4",
        title_p: "Checking attachments tab — downloading and classifying documents...",
        title_s: "Validation 1/14: 2 attachments found — MSA contract + Statement of Work identified",
        reasoning: [
            "Clicked 'Attachments' tab in PR detail view",
            "Found 2 attachments:",
            "  Attachment 1: MSA_Boehringer_Ingelheim_2021_0044.pdf (47 pages, 1.2MB)",
            "    Classified: Master Service Agreement (confidence: 0.97)",
            "  Attachment 2: SOW_BI_CRO_Services_2026.pdf (18 pages, 890KB)",
            "    Classified: Statement of Work (confidence: 0.94)",
            "Both documents downloaded to processing queue",
            "Validation 1/14 — Attachment: PASS (2 docs, MSA + SOW)"
        ],
        artifacts: [
            {
                id: "pdf-msa-6",
                type: "file",
                label: "MSA — Boehringer Ingelheim (2021-0044)",
                pdfPath: "/data/bachem_invoice_2026.pdf"
            }
        ]
    };

    // ── STAGE 5: Structured data extraction from documents ────────────────────
    const step5 = {
        id: "step-5",
        title_p: "Extracting structured data from MSA and Statement of Work...",
        title_s: "ALERT: MSA annual cap EUR 2,500,000 — PR total EUR 2,780,000 exceeds cap by EUR 280,000",
        reasoning: [
            "Parsed MSA_Boehringer_Ingelheim_2021_0044.pdf (47 pages):",
            "  MSA ID: MSA-BI-2021-0044",
            "  Effective date: 2021-07-01",
            "  Renewal date: 2026-07-01",
            "  Annual service cap: EUR 2,500,000 (Sections 4, 6, and 9 — all CRO services)",
            "  Cap applies to: clinical trial management, regulatory affairs, data management",
            "Parsed SOW_BI_CRO_Services_2026.pdf (18 pages):",
            "  SOW scope confirmed: Phase II Trial Mgmt + Regulatory Affairs + Data Management",
            "  Scope matches all 3 PR line items exactly",
            "Cross-check — PR total vs MSA cap:",
            "  PR-2026-01567 total: EUR 2,780,000.00",
            "  MSA-BI-2021-0044 annual cap: EUR 2,500,000.00",
            "  Cap exceedance: EUR 280,000.00 (+11.2%)",
            "Root cause: Data Management & Biostatistics LOT (EUR 380,000) was not in original MSA budget model",
            "Issue flagged — proceeding to full validation suite"
        ],
        artifacts: [
            {
                id: "msa-extracted-6",
                type: "json",
                label: "MSA & SOW Extracted Data",
                data: {
                    msa_id: "MSA-BI-2021-0044",
                    msa_annual_cap: "EUR 2,500,000.00",
                    msa_cap_sections: "Sections 4, 6, 9 — all CRO services",
                    msa_effective: "2021-07-01",
                    msa_renewal_date: "2026-07-01",
                    sow_scope: "Phase II Trial Mgmt + Regulatory Affairs + Data Management — confirmed",
                    pr_total: "EUR 2,780,000.00",
                    cap_exceedance: "EUR 280,000.00",
                    cap_exceedance_pct: "11.2%",
                    issue: "MSA annual cap exceeded — amendment or executive approval required"
                }
            }
        ]
    };

    // ── STAGE 6a: Validations V2–V8 ───────────────────────────────────────────
    const step6a = {
        id: "step-6a",
        title_p: "Running validation domains 2 through 8...",
        title_s: "Validations 2–8: 6 PASS, 1 FAIL — V7 Pricing fails on MSA cap exceedance",
        reasoning: [
            "V2 Accounting: CC-US-RD-003 valid, GL 67100200 linked correctly ✓ PASS",
            "V3 Budget Owner: Sarah Whitfield ≠ Dr. Robert Kingsley — segregation of duties confirmed ✓ PASS",
            "V4 Currency: EUR consistent across PR header, all 3 line items, and MSA ✓ PASS",
            "V5 Material Group: MG-CRO-001 approved for clinical services in GL master ✓ PASS",
            "V6 Supplier ID: 'Boehringer Ingelheim GmbH' — exact match SUP-44219 ✓ PASS",
            "V7 Pricing: FAIL — EUR 2,780,000 exceeds MSA-BI-2021-0044 annual cap EUR 2,500,000 by EUR 280,000 (+11.2%)",
            "V8 Service Type: SAC 998112 (clinical research) — valid for CRO services ✓ PASS"
        ]
    };

    // ── STAGE 6b: Validations V9–V14 ──────────────────────────────────────────
    const step6b = {
        id: "step-6b",
        title_p: "Running validation domains 9 through 14...",
        title_s: "Validations 9–14: all 6 PASS — overall result: FAIL (V7 Pricing)",
        reasoning: [
            "V9  Ordering Method: PORTAL, bi-procurement@boehringer-ingelheim.com — domain verified ✓ PASS",
            "V10 Ship-To: SHIP-US-003 (Parsippany R&D facility) linked to company code 4100 ✓ PASS",
            "V11 Sold-To: Company code 4100 = Ferring Pharmaceuticals Inc. ✓ PASS",
            "V12 Company Code: Ferring Pharmaceuticals Inc. — confidence 0.99 ✓ PASS",
            "V13 Quantity: All 3 line items match SOW scope individually ✓ PASS",
            "V14 Deliver-To: Ferring Pharmaceuticals Inc., 100 Interpace Pkwy, Parsippany NJ — valid ✓ PASS",
            "Overall: 13 PASS, 1 FAIL (V7 Pricing / MSA cap) — auto-approval blocked",
            "Note: MSA-BI-2021-0044 renews 2026-07-01 — within 97 days; flag for renewal planning"
        ],
        artifacts: [
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
                        "V7 Pricing": "FAIL — EUR 2,780,000 exceeds MSA cap EUR 2,500,000 by EUR 280,000 (+11.2%)",
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
                    ]
                }
            }
        ]
    };

    // ── STAGE 7: Overall FAIL — gap analysis + draft email ────────────────────
    const step7 = {
        id: "step-7",
        title_p: "Overall status: FAIL — generating gap analysis and drafting vendor email...",
        title_s: "Gap analysis complete — EUR 280,000 MSA cap exceedance, drafting resolution request to Boehringer Ingelheim",
        reasoning: [
            "Root cause: Data Management & Biostatistics LOT (EUR 380,000) not included in original MSA-BI-2021-0044 budget model",
            "Options evaluated:",
            "  (a) Reduce scope to fit EUR 2,500,000 cap — would remove Data Management LOT entirely",
            "  (b) Execute MSA Amendment raising annual cap — estimated 3-4 weeks",
            "  (c) CFO-level exception approval — expedited ~5 business days",
            "Recommendation: Contact Boehringer Ingelheim to request scope reduction or formal MSA amendment proposal",
            "All other 13 validations pass — issue isolated to MSA cap",
            "Drafting email to bi-procurement@boehringer-ingelheim.com"
        ],
        artifacts: [
            {
                id: "gap-analysis-6",
                type: "json",
                label: "Gap Analysis",
                data: {
                    pr_id: "PR-2026-01567",
                    issue: "MSA Annual Cap Exceedance",
                    msa_cap: "EUR 2,500,000.00",
                    pr_total: "EUR 2,780,000.00",
                    excess: "EUR 280,000.00 (+11.2%)",
                    resolution_options: [
                        "Reduce scope to fit cap (requires revised SOW)",
                        "Execute MSA amendment raising cap (3-4 weeks)",
                        "CFO exception approval (~5 business days)"
                    ]
                }
            }
        ]
    };

    // ── STAGE 8: HITL GATE 1 — Email draft awaiting approval ─────────────────
    const step8_hitl1 = {
        id: "step-8",
        title_p: "Drafting email to Boehringer Ingelheim — requesting MSA cap resolution...",
        title_s: "Email draft ready — HITL Gate 1: awaiting approval to send",
        reasoning: [
            "To: bi-procurement@boehringer-ingelheim.com",
            "CC: dr.robert.kingsley@ferring.com, sarah.whitfield@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
            "Subject: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance — MSA-BI-2021-0044",
            "Email explains the cap calculation, identifies the Data Management LOT as the source",
            "Requests formal proposal by 2026-03-28: scope reduction OR MSA amendment",
            "Clearly states PR cannot be approved until resolved",
            "Human review required before sending — HITL Gate 1"
        ],
        artifacts: [
            {
                id: "email-draft-6-gate1",
                type: "email_draft",
                label: "Email Draft: MSA Cap Resolution Request",
                data: {
                    isIncoming: false,
                    to: "bi-procurement@boehringer-ingelheim.com",
                    cc: "dr.robert.kingsley@ferring.com, sarah.whitfield@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
                    subject: "MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance — MSA-BI-2021-0044",
                    body: "Dear Boehringer Ingelheim Procurement Team,\n\nWe are processing Purchase Requisition PR-2026-01567 (EUR 2,780,000.00) for CRO services under Master Service Agreement MSA-BI-2021-0044.\n\nOur automated validation has identified an MSA annual cap exceedance:\n\n   PR-2026-01567 Total:                  EUR 2,780,000.00\n   MSA-BI-2021-0044 Annual Cap (§4,6,9): EUR 2,500,000.00\n   Exceedance:                           EUR 280,000.00 (+11.2%)\n\nThe exceedance relates primarily to the Data Management & Biostatistics scope (EUR 380,000 LOT) added in the 2026 SOW.\n\nTo proceed, we require one of the following by 28 March 2026:\n   a) A revised SOW reducing scope to EUR 2,500,000 or below, or\n   b) A formal MSA amendment proposal raising the annual cap to EUR 2,800,000 or higher.\n\nPlease note: PR-2026-01567 cannot be approved in SAP Ariba until this is resolved.\n\nBest regards,\nFerring Pharmaceuticals — Global Procurement\nsarah.whitfield@ferring.com"
                }
            }
        ]
    };

    // ── Post Gate 1: ServiceNow vendor tracking ticket ─────────────────────────
    const step8b_snow = {
        id: "step-8b",
        title_p: "Creating ServiceNow ticket for vendor clarification tracking...",
        title_s: "ServiceNow ticket INC-2026-05102 updated — MSA cap query raised with Boehringer Ingelheim",
        reasoning: [
            "Returned to ServiceNow portal",
            "Updated ticket INC-2026-05102 with current status:",
            "  Work note: 'PR-2026-01567 — V7 Pricing FAIL. MSA-BI-2021-0044 cap EUR 2,500,000 exceeded by EUR 280,000. Resolution request sent to Boehringer Ingelheim. Awaiting vendor response.'",
            "  Category updated: Procurement — Contract Compliance",
            "  Priority updated: High — contract compliance issue",
            "Ticket remains In Progress — monitoring inbox for vendor response"
        ],
        artifacts: [
            {
                id: "v-snow-update-6",
                type: "video",
                label: "ServiceNow: Ticket INC-2026-05102 Updated",
                videoPath: "/data/servicenow_fpr006.webm"
            },
            {
                id: "snow-updated-6",
                type: "json",
                label: "ServiceNow Ticket Updated",
                data: {
                    ticket_id: "INC-2026-05102",
                    status: "In Progress",
                    work_note: "PR-2026-01567 — V7 Pricing FAIL. MSA cap exceeded by EUR 280,000. Resolution request sent to vendor. Awaiting response.",
                    category: "Procurement — Contract Compliance",
                    priority: "High",
                    timestamp: "2026-03-26T10:45:00Z"
                }
            }
        ]
    };

    // ── Vendor response ────────────────────────────────────────────────────────
    const step8c_vendor = {
        id: "step-8c",
        title_p: "Monitoring inbox for Boehringer Ingelheim response...",
        title_s: "Vendor response received — Boehringer acknowledges cap issue, proposes MSA Amendment No. 3",
        reasoning: [
            "Email received from bi-procurement@boehringer-ingelheim.com at 11:17 UTC",
            "Subject: RE: MSA Cap Issue — PR-2026-01567",
            "Boehringer confirms: 'We acknowledge the EUR 280,000 cap exceedance.'",
            "Boehringer position: 'The Data Management & Biostatistics scope cannot be reduced — Phase II trial requirements mandate the full LOT.'",
            "Proposed resolution: MSA Amendment No. 3 — raise annual cap EUR 2,500,000 → EUR 2,900,000",
            "Draft amendment attached: MSA_BI_2021_0044_Amendment3_Draft.pdf (8 pages)",
            "Amendment timeline: 10-15 business days (Ferring Legal + CFO signatures required)",
            "Assessment: Scope reduction not viable; amendment required; PR must be rejected and resubmitted post-amendment"
        ],
        artifacts: [
            {
                id: "vendor-reply-6",
                type: "email_draft",
                label: "Incoming: Boehringer Response — MSA Amendment Proposed",
                data: {
                    isIncoming: true,
                    from: "bi-procurement@boehringer-ingelheim.com",
                    to: "sarah.whitfield@ferring.com",
                    subject: "RE: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance",
                    body: "Dear Sarah,\n\nThank you for your message regarding PR-2026-01567 and the MSA-BI-2021-0044 annual cap.\n\nWe confirm the EUR 280,000 exceedance. However, we are unable to reduce the Data Management & Biostatistics scope below the stated EUR 380,000 LOT. The Phase II trial protocol requires the full statistical analysis package as specified in the 2026 SOW.\n\nTo resolve this matter, we propose executing MSA Amendment No. 3, which would raise the annual service cap from EUR 2,500,000 to EUR 2,900,000, providing adequate headroom for this and future cycle requirements.\n\nWe have attached a draft amendment for Ferring Legal review. Subject to your team's availability, we estimate signature within 10-15 business days.\n\nPlease advise how to proceed.\n\nBest regards,\nBoehringer Ingelheim GmbH — Strategic Procurement\nbi-procurement@boehringer-ingelheim.com"
                }
            },
            {
                id: "assessment-6",
                type: "json",
                label: "Resolution Assessment",
                data: {
                    vendor_response: "Cannot reduce scope — Data Management LOT mandatory for Phase II protocol",
                    proposed_path: "MSA Amendment No. 3: annual cap EUR 2,500,000 → EUR 2,900,000",
                    amendment_timeline: "10-15 business days",
                    pr_outcome: "REJECT — resubmit after MSA amendment executed",
                    next_steps: [
                        "Route MSA Amendment No. 3 draft to Ferring Legal",
                        "CFO approval required",
                        "Resubmit PR-2026-01567 after amendment signature"
                    ]
                }
            }
        ]
    };

    // ── STAGE 8b: HITL GATE 2 — Rejection email draft ─────────────────────────
    const step8d_hitl2 = {
        id: "step-8d",
        title_p: "Drafting final PR rejection email — MSA amendment must be executed first...",
        title_s: "Rejection email drafted — HITL Gate 2: awaiting approval to send",
        reasoning: [
            "To: bi-procurement@boehringer-ingelheim.com",
            "CC: dr.robert.kingsley@ferring.com, sarah.whitfield@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
            "Subject: PR-2026-01567 REJECTED — MSA Amendment Required Before Resubmission",
            "Acknowledges Boehringer's amendment proposal as the correct resolution path",
            "Routes MSA Amendment No. 3 draft to Ferring Legal and CFO Office",
            "Clear instruction: PR rejected; resubmit after Amendment No. 3 is fully executed",
            "References: validation run FPR_006, ServiceNow INC-2026-05102",
            "Human review required before sending — HITL Gate 2"
        ],
        artifacts: [
            {
                id: "email-draft-6-gate2",
                type: "email_draft",
                label: "Email Draft: Final Rejection + MSA Amendment Routing",
                data: {
                    isIncoming: false,
                    to: "bi-procurement@boehringer-ingelheim.com",
                    cc: "dr.robert.kingsley@ferring.com, sarah.whitfield@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
                    subject: "PR-2026-01567 REJECTED — MSA Amendment Required Before Resubmission",
                    body: "Dear Boehringer Ingelheim Team,\n\nThank you for your response and for attaching the draft MSA Amendment No. 3.\n\nWe have reviewed the situation and confirm:\n   - The scope reduction path is not viable given Phase II protocol requirements\n   - MSA Amendment No. 3 (cap EUR 2,500,000 → EUR 2,900,000) is the correct resolution path\n\nPR-2026-01567 has been formally REJECTED in SAP Ariba pending execution of the MSA amendment.\n\nNext steps:\n   1. Draft MSA Amendment No. 3 has been routed to Ferring Legal (legal-contracts@ferring.com)\n      and CFO Office (cfo-office@ferring.com) for review and signature\n   2. Estimated timeline: 10-15 business days\n   3. Once Amendment No. 3 is fully executed, Dr. Robert Kingsley will resubmit PR-2026-01567\n\nReference: Validation run FPR_006 | ServiceNow: INC-2026-05102 | Rejection timestamp: 2026-03-26T14:22:00Z\n\nBest regards,\nFerring Pharmaceuticals — Global Procurement\nsarah.whitfield@ferring.com"
                }
            }
        ]
    };

    // ── STAGE 9a: Reject in SAP Ariba ─────────────────────────────────────────
    const step9a_reject = {
        id: "step-9a",
        title_p: "Desktop agent returning to SAP Ariba — rejecting PR-2026-01567...",
        title_s: "PR-2026-01567 rejected in SAP Ariba — status: Pending Approval → Rejected",
        reasoning: [
            "Desktop agent re-authenticated to SAP Ariba as pace.agent@ferring.com",
            "Navigated to PR-2026-01567",
            "Selected 'Reject' from approver actions menu",
            "Entered rejection comment: 'MSA-BI-2021-0044 annual cap EUR 2,500,000 exceeded by EUR 280,000 (+11.2%). MSA Amendment No. 3 required before approval. ServiceNow: INC-2026-05102. Resubmit after amendment execution. Ref: FPR_006.'",
            "Confirmed rejection — status: Pending Approval → Rejected",
            "Confirmation received (200 OK)",
            "Rejection timestamp: 2026-03-26T14:22:00Z"
        ],
        artifacts: [
            {
                id: "v-ariba-reject-6",
                type: "video",
                label: "SAP Ariba: PR-2026-01567 Rejection",
                videoPath: "/data/sap_ariba_rejection_fpr006.webm"
            },
            {
                id: "ariba-reject-confirm-6",
                type: "json",
                label: "SAP Ariba Rejection Confirmation",
                data: {
                    action: "REJECTED",
                    pr_id: "PR-2026-01567",
                    status_before: "Pending Approval",
                    status_after: "Rejected",
                    rejection_comment: "MSA-BI-2021-0044 annual cap EUR 2,500,000 exceeded by EUR 280,000 (+11.2%). MSA Amendment No. 3 required. Resubmit after amendment execution. Ref: FPR_006.",
                    rejected_by: "Pace Automation Agent",
                    timestamp: "2026-03-26T14:22:00Z",
                    api_response: "200 OK"
                }
            }
        ]
    };

    // ── STAGE 9b: ServiceNow resolved + audit trail ────────────────────────────
    const step9b_final = {
        id: "step-9b",
        title_p: "Resolving ServiceNow ticket INC-2026-05102 and generating audit trail...",
        title_s: "ServiceNow INC-2026-05102 resolved — PR rejected, MSA amendment routed, process complete",
        reasoning: [
            "Returned to ServiceNow portal",
            "Opened ticket INC-2026-05102",
            "Posted resolution work note: 'PR-2026-01567 validated and rejected. MSA-BI-2021-0044 annual cap exceeded by EUR 280,000. MSA Amendment No. 3 routed to Ferring Legal and CFO. PR to be resubmitted after amendment execution.'",
            "Updated ticket status: In Progress → Resolved",
            "Resolution code: Procurement — Escalated for contract amendment",
            "Resolution timestamp: 2026-03-26T14:23:00Z",
            "Closure confirmation received",
            "Process FPR_006 complete",
            "Total duration: ~3m 10s (excluding HITL wait times)",
            "Systems accessed: ServiceNow, SAP Ariba (3 sessions)",
            "Attachments processed: 2 (MSA + SOW)",
            "Validations run: 14 — 13 passed, 1 failed",
            "HITL gates triggered: 2 (MSA resolution email + final rejection email)",
            "Vendor interaction rounds: 1"
        ],
        artifacts: [
            {
                id: "snow-resolved-6",
                type: "json",
                label: "ServiceNow Ticket Resolved",
                data: {
                    ticket_id: "INC-2026-05102",
                    status_before: "In Progress",
                    status_after: "Resolved",
                    resolution_note: "PR-2026-01567 rejected. MSA-BI-2021-0044 cap exceeded by EUR 280,000. MSA Amendment No. 3 routed to Legal + CFO. PR to be resubmitted after amendment execution.",
                    resolution_code: "Procurement — Escalated for contract amendment",
                    resolved_by: "Pace Automation Agent",
                    timestamp: "2026-03-26T14:23:00Z"
                }
            },
            {
                id: "audit-trail-6",
                type: "json",
                label: "Complete Audit Trail",
                data: {
                    process_id: "FPR_006",
                    pr_id: "PR-2026-01567",
                    servicenow_ticket: "INC-2026-05102",
                    started: "2026-03-26T08:45:00Z",
                    completed: "2026-03-26T14:24:00Z",
                    outcome: "REJECTED",
                    systems_accessed: ["ServiceNow", "SAP Ariba"],
                    attachments_processed: 2,
                    validations: { run: 14, passed: 13, failed: 1 },
                    hitl_gates: 2,
                    vendor_rounds: 1,
                    sap_ariba_status: "Rejected",
                    servicenow_status: "Resolved",
                    msa_amendment_routed: true
                }
            }
        ]
    };

    // ── EXECUTION LOOP ─────────────────────────────────────────────────────────

    // Helper: run a normal (non-HITL) step
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
            const sentTitle = step.id === 'step-8'
                ? 'MSA resolution email sent to Boehringer Ingelheim — monitoring inbox for response'
                : 'Final rejection email sent — proceeding to SAP Ariba rejection';
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
                title: 'Process halted by reviewer',
                status: 'warning',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted by reviewer at HITL gate');
            return false;
        }
    };

    // Stages 1–7: normal steps
    await runStep(step1);
    await runStep(step2);
    await runStep(step3);
    await runStep(step4);
    await runStep(step5);
    await runStep(step6a);
    await runStep(step6b);
    await runStep(step7);

    // Stage 8 HITL Gate 1
    const gate1Passed = await runHitlStep(step8_hitl1, 'HITL Gate 1: MSA Resolution Email Pending');
    if (!gate1Passed) return;

    // Post Gate 1: ServiceNow update + simulate vendor response delay
    await runStep(step8b_snow);
    console.log(`${PROCESS_ID}: Simulating vendor response delay (3s)...`);
    await delay(3000);
    await runStep(step8c_vendor);

    // Stage 8b HITL Gate 2
    const gate2Passed = await runHitlStep(step8d_hitl2, 'HITL Gate 2: Final Rejection Email Pending');
    if (!gate2Passed) return;

    // Stage 9: reject in Ariba, resolve ServiceNow, audit trail
    await runStep(step9a_reject);
    await runStep(step9b_final, true);

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
