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

// Per-process HITL: polls /hitl/FPR_006 until action='send' or 'reject'
const waitForHITL = async () => {
    console.log("FPR_006: Waiting for HITL action (send or reject)...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        await fetch(`${API_URL}/hitl/FPR_006`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pending: true, action: null })
        });
    } catch (e) {}
    try {
        await fetch(`${API_URL}/email-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sent: false })
        });
    } catch (e) {}
    while (true) {
        try {
            const r = await fetch(`${API_URL}/hitl/FPR_006`);
            const d = await r.json();
            if (d.action === 'send') { console.log("FPR_006: HITL resolved → send"); return 'send'; }
            if (d.action === 'reject') { console.log("FPR_006: HITL resolved → reject"); return 'reject'; }
        } catch (e) {}
        await delay(2000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    const allSteps = [
        // STEP 1: ServiceNow trigger
        {
            id: "step-1",
            title_p: "ServiceNow ticket INC-2026-05102 received — initiating PR validation workflow...",
            title_s: "Trigger received — ServiceNow INC-2026-05102 mapped to PR-2026-01567",
            reasoning: [
                "ServiceNow ticket INC-2026-05102 received at 08:45 UTC",
                "Category: Procurement / Purchase Requisition Approval",
                "Description: 'PR-2026-01567 — Boehringer Ingelheim CRO services renewal, EUR 2,780,000. Requires validation before SAP Ariba approval.'",
                "Requested by: Sophie Beaumont (Global Procurement Lead)",
                "Priority: High (MSA contract renewal, deadline: 2026-03-31)",
                "Pace workflow triggered: PR Validation → FPR-006",
                "Ticket INC-2026-05102 status set to: In Progress"
            ],
            artifacts: [
                {
                    id: "v-servicenow-6",
                    type: "video",
                    label: "ServiceNow: Ticket INC-2026-05102",
                    videoPath: "/data/servicenow_fpr006.webm"
                },
                {
                    id: "snow-ticket-6",
                    type: "json",
                    label: "ServiceNow Ticket Data",
                    data: {
                        ticket_id: "INC-2026-05102",
                        category: "Procurement / PR Approval",
                        pr_reference: "PR-2026-01567",
                        requester: "Sophie Beaumont",
                        priority: "High",
                        description: "PR-2026-01567 — Boehringer Ingelheim CRO services renewal, EUR 2,780,000. MSA cap validation required.",
                        created: "2026-03-26T08:45:00Z",
                        status: "In Progress"
                    }
                }
            ]
        },
        // STEP 2: SAP Ariba login + navigate to PR
        {
            id: "step-2",
            title_p: "Desktop agent connecting to SAP Ariba — navigating to PR-2026-01567...",
            title_s: "Connected to SAP Ariba — PR-2026-01567 opened, Boehringer Ingelheim, EUR 2,780,000",
            reasoning: [
                "Authenticated to SAP Ariba as pace.agent@ferring.com",
                "Session established (SESS-2026-03-26-0845)",
                "Navigated to Manage → Purchase Requisitions",
                "Searched PR-2026-01567 — status: Pending Approval",
                "Opened PR detail view",
                "Reading PR header fields..."
            ],
            artifacts: [
                {
                    id: "v-ariba-6",
                    type: "video",
                    label: "SAP Ariba: PR-2026-01567 Detail View",
                    videoPath: "/data/sap_ariba_desktop_agent_fpr006.webm"
                }
            ]
        },
        // STEP 3: Read PR header fields
        {
            id: "step-3",
            title_p: "Reading all PR-2026-01567 header fields...",
            title_s: "PR header extracted — Boehringer Ingelheim GmbH, EUR 2,780,000, Germany region",
            reasoning: [
                "Read Requester: Sophie Beaumont",
                "Read Budget Owner: Dr. Heinrich Müller (VP Clinical Operations)",
                "Read Company Code: 1500 (Ferring GmbH, Germany)",
                "Read Cost Center: CC-CLIN-DE-007",
                "Read Currency: EUR",
                "Read Total Amount: EUR 2,780,000.00",
                "Read Supplier: Boehringer Ingelheim GmbH (Supplier ID: SUP-44219)",
                "Read Contract Reference: MSA-BI-2021-0044",
                "Read Region: Germany (EMEA)",
                "Read PR date: 2026-03-20"
            ],
            artifacts: [
                {
                    id: "pr-header-6",
                    type: "json",
                    label: "PR-2026-01567 Header Data",
                    data: {
                        pr_id: "PR-2026-01567",
                        company_code: "1500",
                        entity: "Ferring GmbH",
                        requester: "Sophie Beaumont",
                        budget_owner: "Dr. Heinrich Müller",
                        cost_center: "CC-CLIN-DE-007",
                        currency: "EUR",
                        total_amount: "2,780,000.00",
                        supplier: "Boehringer Ingelheim GmbH",
                        supplier_id: "SUP-44219",
                        contract_ref: "MSA-BI-2021-0044",
                        region: "Germany (EMEA)",
                        pr_date: "2026-03-20"
                    }
                }
            ]
        },
        // STEP 4: Extract line items
        {
            id: "step-4",
            title_p: "Opening line items tab and reading all 3 items...",
            title_s: "3 line items extracted — CRO services covering Phase II/III clinical support",
            reasoning: [
                "Clicked 'Line Items' tab in PR detail view",
                "Line 1: Phase II Clinical Trial Management — 12 months × EUR 150,000 = EUR 1,800,000.00",
                "Line 2: Regulatory Affairs Support — 12 months × EUR 50,000 = EUR 600,000.00",
                "Line 3: Data Management & Biostatistics — 1 LOT × EUR 380,000.00 = EUR 380,000.00",
                "Sum: EUR 1,800,000 + EUR 600,000 + EUR 380,000 = EUR 2,780,000.00 — matches PR total",
                "All line items reference contract MSA-BI-2021-0044"
            ],
            artifacts: [
                {
                    id: "line-items-6",
                    type: "json",
                    label: "PR-2026-01567 Line Items",
                    data: {
                        line_items: [
                            { line: "1", description: "Phase II Clinical Trial Management", qty: "12 months", unit_price: "EUR 150,000.00", total: "EUR 1,800,000.00" },
                            { line: "2", description: "Regulatory Affairs Support", qty: "12 months", unit_price: "EUR 50,000.00", total: "EUR 600,000.00" },
                            { line: "3", description: "Data Management & Biostatistics", qty: "1 LOT", unit_price: "EUR 380,000.00", total: "EUR 380,000.00" }
                        ],
                        sum_check: "EUR 2,780,000.00 = PR total ✓"
                    }
                }
            ]
        },
        // STEP 5: Download + classify 2 attachments
        {
            id: "step-5",
            title_p: "Opening attachments tab — downloading MSA and SOW documents...",
            title_s: "Validation 1/14: 2 attachments found — MSA contract + Statement of Work identified",
            reasoning: [
                "Clicked 'Attachments' tab in PR detail view",
                "Found 2 attachments:",
                "  Attachment 1: MSA_Boehringer_Ingelheim_2021_0044.pdf (47 pages, 1.2MB) — classified: Master Service Agreement (confidence: 0.97)",
                "  Attachment 2: SOW_BI_CRO_Services_2026.pdf (18 pages, 890KB) — classified: Statement of Work (confidence: 0.94)",
                "Both documents downloaded to processing queue",
                "Extracting structured data from both documents..."
            ],
            artifacts: [
                {
                    id: "pdf-msa-6",
                    type: "file",
                    label: "MSA — Boehringer Ingelheim (2021-0044)",
                    pdfPath: "/data/bachem_invoice_2026.pdf"
                }
            ]
        },
        // STEP 6: Extract data from both documents
        {
            id: "step-6",
            title_p: "Extracting structured data from MSA and SOW...",
            title_s: "ALERT: MSA annual cap EUR 2,500,000 — invoice total EUR 2,780,000 exceeds cap by EUR 280,000",
            reasoning: [
                "MSA-BI-2021-0044 extracted: Annual service cap = EUR 2,500,000 per contract year",
                "MSA cap applies to: all CRO services under Sections 4, 6, and 9 of MSA-BI-2021-0044",
                "SOW-2026 extracted: Scope confirmation matches PR line items — scope is accurate",
                "Invoice total: EUR 2,780,000.00 (from PR)",
                "MSA annual cap: EUR 2,500,000.00",
                "Cap exceedance: EUR 280,000.00 (+11.2%) — requires MSA amendment or executive approval"
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
                        sow_scope: "Phase II Trial Mgmt + Regulatory + Data Management — confirmed",
                        pr_total: "EUR 2,780,000.00",
                        cap_exceedance: "EUR 280,000.00",
                        cap_exceedance_pct: "11.2%",
                        issue: "MSA annual cap exceeded — amendment or executive approval required"
                    }
                }
            ]
        },
        // STEP 7: Supplier Master check
        {
            id: "step-7",
            title_p: "Checking Ferring Supplier Master for Boehringer Ingelheim GmbH...",
            title_s: "Supplier Master: Boehringer Ingelheim GmbH (SUP-44219) — Active, PASS",
            reasoning: [
                "Opened Ferring Supplier Master portal",
                "Searched for 'Boehringer Ingelheim' — found 1 active record",
                "SUP-44219: Boehringer Ingelheim GmbH — Active, EMEA, registration date 2018-04-12",
                "Supplier name on PR matches Supplier Master exactly: 'Boehringer Ingelheim GmbH' ✓",
                "No purchasing blocks or compliance flags",
                "V6 Supplier Validation: PASS"
            ],
            artifacts: [
                {
                    id: "supplier-master-6",
                    type: "json",
                    label: "Supplier Master Result",
                    data: {
                        search_term: "Boehringer Ingelheim",
                        result: { supplier_id: "SUP-44219", name: "Boehringer Ingelheim GmbH", status: "Active", region: "EMEA", registration_date: "2018-04-12" },
                        pr_supplier_name: "Boehringer Ingelheim GmbH",
                        match: "EXACT MATCH ✓",
                        v6_result: "PASS"
                    }
                }
            ]
        },
        // STEP 8: Full validation suite
        {
            id: "step-8",
            title_p: "Running comprehensive validation suite (14 domains)...",
            title_s: "Validations complete — 12 PASS, 1 FAIL (MSA cap), 1 informational (contract renewal)",
            reasoning: [
                "V1 Attachment: 2 docs classified — MSA (0.97) + SOW (0.94) — PASS",
                "V2 Accounting: CC-CLIN-DE-007, GL 67100200 — PASS",
                "V3 Budget Owner: Dr. Müller ≠ Sophie Beaumont — PASS",
                "V4 Currency: EUR matches throughout — PASS",
                "V5 Material Group: MG-CRO-001 approved for clinical services — PASS",
                "V6 Supplier: Boehringer Ingelheim GmbH — exact match SUP-44219 — PASS",
                "V7 Pricing: FAIL — EUR 2,780,000 exceeds MSA annual cap EUR 2,500,000 by EUR 280,000 (+11.2%)",
                "V8 Service Type: SAC 998112 (clinical research) — PASS",
                "V9 Ordering: PORTAL method, bi-procurement@boehringer-ingelheim.com — PASS",
                "V10 Ship-To: SHIP-DE-007 linked to entity 1500 — PASS",
                "V11 Sold-To: 1500 = 1500 — PASS",
                "V12 Company Code: Ferring GmbH, confidence 0.99 — PASS",
                "V13 Quantity: All 3 lines match SOW scope — PASS",
                "V14 Deliver-To: Ferring GmbH, Wittmund, Germany — PASS"
            ],
            artifacts: [
                {
                    id: "validation-scorecard-6",
                    type: "json",
                    label: "Validation Scorecard",
                    data: {
                        overall_status: "FAIL",
                        total: 14, passed: 12, failed: 1, informational: 1,
                        failures: [
                            { check: "V7 Pricing / MSA Cap", result: "FAIL", detail: "PR EUR 2,780,000 exceeds MSA-BI-2021-0044 annual cap EUR 2,500,000 by EUR 280,000 (+11.2%)" }
                        ],
                        informational: [{ check: "MSA Renewal", note: "MSA-BI-2021-0044 renews 2026-07-01 — within 100 days; confirm renewal terms before next cycle" }]
                    }
                }
            ]
        },
        // STEP 9: Gap analysis
        {
            id: "step-9",
            title_p: "Generating gap analysis — MSA cap exceedance documentation...",
            title_s: "Gap analysis complete — EUR 280,000 MSA cap exceedance requires vendor discussion or contract amendment",
            reasoning: [
                "Root cause: Service scope expanded for Data Management & Biostatistics LOT (EUR 380,000) not included in original MSA budget model",
                "Options: (a) Reduce scope to fit within EUR 2,500,000 cap, (b) Execute MSA amendment raising annual cap, (c) Obtain CFO-level exception approval",
                "MSA amendment timeline: typically 3-4 weeks — would delay trial by one month",
                "Recommendation: Draft email to Boehringer Ingelheim requesting scope reduction or formal MSA cap amendment proposal",
                "All other validations pass — issue is isolated to MSA cap exceedance"
            ],
            artifacts: [
                {
                    id: "gap-analysis-6",
                    type: "json",
                    label: "Gap Analysis",
                    data: {
                        pr_id: "PR-2026-01567",
                        issue: "MSA Annual Cap Exceedance",
                        msa_cap: "EUR 2,500,000",
                        pr_total: "EUR 2,780,000",
                        excess: "EUR 280,000 (+11.2%)",
                        resolution_options: [
                            "Reduce scope to fit cap (requires new SOW)",
                            "Execute MSA cap amendment (3-4 week timeline)",
                            "CFO exception approval (expedited 5 business days)"
                        ]
                    }
                }
            ]
        },
        // STEP 10: HITL GATE 1 — Email to Boehringer requesting resolution
        {
            id: "step-10",
            hitl: "email",
            hitl_gate: 1,
            title_p: "Drafting email to Boehringer Ingelheim requesting MSA cap resolution...",
            title_s: "Email draft ready — awaiting approval to send",
            reasoning: [
                "Email to: bi-procurement@boehringer-ingelheim.com",
                "CC: sophie.beaumont@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
                "Subject: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance — MSA-BI-2021-0044",
                "Body explains cap calculation, scope details, and requests formal proposal by 2026-03-28",
                "Offers two resolution paths: scope reduction or MSA amendment",
                "Awaiting approval to send"
            ],
            artifacts: [
                {
                    id: "email-draft-6-gate1",
                    type: "email_draft",
                    label: "Email Draft: MSA Cap Resolution Request",
                    data: {
                        isIncoming: false,
                        to: "bi-procurement@boehringer-ingelheim.com",
                        cc: "sophie.beaumont@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
                        subject: "MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance — MSA-BI-2021-0044",
                        body: "Dear Boehringer Ingelheim Procurement Team,\n\nWe are processing Purchase Requisition PR-2026-01567 (EUR 2,780,000.00) for CRO services under Master Service Agreement MSA-BI-2021-0044.\n\nOur automated validation has identified an MSA annual cap exceedance:\n\n   PR-2026-01567 Total: EUR 2,780,000.00\n   MSA-BI-2021-0044 Annual Cap (Sections 4, 6, 9): EUR 2,500,000.00\n   Exceedance: EUR 280,000.00 (+11.2%)\n\nThe exceedance relates primarily to the Data Management & Biostatistics scope (EUR 380,000 LOT) added in the 2026 SOW.\n\nTo proceed, we require one of the following by 28 March 2026:\n   a) A revised SOW reducing scope to EUR 2,500,000 or below, or\n   b) A formal MSA amendment proposal to raise the annual cap to EUR 2,800,000 (or higher as appropriate).\n\nPlease note: PR-2026-01567 cannot be approved in SAP Ariba until this is resolved.\n\nBest regards,\nFerring GmbH — Global Procurement\nsophie.beaumont@ferring.com"
                    }
                }
            ]
        },
        // STEP 11: Vendor response
        {
            id: "step-11",
            title_p: "Monitoring inbox for Boehringer Ingelheim response...",
            title_s: "Vendor response received — Boehringer acknowledges cap issue, proposes MSA amendment",
            reasoning: [
                "Email received from bi-procurement@boehringer-ingelheim.com at 11:17 UTC",
                "Subject: RE: MSA Cap Issue — PR-2026-01567",
                "Boehringer confirms: 'We acknowledge the EUR 280,000 cap exceedance.'",
                "Boehringer position: 'The Data Management & Biostatistics scope cannot be reduced — Phase II trial requirements mandate the full LOT.'",
                "Proposed resolution: 'We propose executing MSA Amendment No. 3 to raise the annual cap from EUR 2,500,000 to EUR 2,900,000. Draft amendment attached for Ferring legal review.'",
                "Attachment: MSA_BI_2021_0044_Amendment3_Draft.pdf (8 pages)",
                "Analysis: Amendment path requires Ferring Legal + CFO signature — minimum 10 business days"
            ],
            artifacts: [
                {
                    id: "vendor-reply-6",
                    type: "email_draft",
                    label: "Incoming: Boehringer Response — MSA Amendment Proposed",
                    data: {
                        isIncoming: true,
                        from: "bi-procurement@boehringer-ingelheim.com",
                        to: "sophie.beaumont@ferring.com",
                        subject: "RE: MSA Cap Issue — PR-2026-01567 — EUR 280,000 Exceedance",
                        body: "Dear Sophie,\n\nThank you for your message regarding PR-2026-01567 and the MSA-BI-2021-0044 annual cap.\n\nWe confirm the EUR 280,000 exceedance. However, we are unable to reduce the Data Management & Biostatistics scope below the stated EUR 380,000 LOT. The Phase II trial protocol requires the full statistical analysis package as specified in the 2026 SOW.\n\nTo resolve this matter, we propose executing MSA Amendment No. 3, which would raise the annual service cap from EUR 2,500,000 to EUR 2,900,000, providing adequate headroom for this and future cycle requirements.\n\nWe have attached a draft amendment for Ferring Legal review. Subject to your team's availability, we estimate signature within 10-15 business days.\n\nPlease advise how to proceed.\n\nBest regards,\nBoehringer Ingelheim GmbH — Strategic Procurement\nbi-procurement@boehringer-ingelheim.com"
                    }
                }
            ]
        },
        // STEP 12: Assess vendor response
        {
            id: "step-12",
            title_p: "Assessing vendor response and MSA amendment proposal...",
            title_s: "Assessment complete — MSA amendment required before PR can be approved; PR must be rejected pending amendment",
            reasoning: [
                "Boehringer confirms scope cannot be reduced — full Data Management LOT required by trial protocol",
                "Proposed resolution: MSA Amendment No. 3 (EUR 2,500,000 → EUR 2,900,000)",
                "Amendment timeline: 10-15 business days (Legal + CFO signatures required)",
                "Current PR-2026-01567 cannot be approved without executed amendment",
                "Recommendation: Reject PR-2026-01567 with clear reason; requester to resubmit after amendment execution",
                "MSA amendment draft to be routed to legal-contracts@ferring.com and cfo-office@ferring.com"
            ],
            artifacts: [
                {
                    id: "assessment-6",
                    type: "json",
                    label: "Resolution Assessment",
                    data: {
                        vendor_response: "Cannot reduce scope — Data Management LOT mandatory for Phase II protocol",
                        proposed_path: "MSA Amendment No. 3: cap EUR 2,500,000 → EUR 2,900,000",
                        amendment_timeline: "10-15 business days",
                        pr_outcome: "REJECT — resubmit after MSA amendment executed",
                        next_steps: ["Route MSA Amendment draft to Ferring Legal", "CFO approval required", "Resubmit PR after amendment signature"]
                    }
                }
            ]
        },
        // STEP 13: HITL GATE 2 — Final rejection email
        {
            id: "step-13",
            hitl: "email",
            hitl_gate: 2,
            title_p: "Drafting final PR rejection email — MSA amendment must be executed first...",
            title_s: "Final rejection email drafted — awaiting approval to send",
            reasoning: [
                "Email to: bi-procurement@boehringer-ingelheim.com, sophie.beaumont@ferring.com",
                "CC: legal-contracts@ferring.com, cfo-office@ferring.com",
                "Subject: PR-2026-01567 REJECTED — MSA Amendment Required Before Resubmission",
                "Acknowledges Boehringer's amendment proposal, routes draft to Ferring Legal and CFO",
                "Clear instruction: PR-2026-01567 rejected; resubmit after Amendment No. 3 is executed",
                "Awaiting approval to send"
            ],
            artifacts: [
                {
                    id: "email-draft-6-gate2",
                    type: "email_draft",
                    label: "Email Draft: Final Rejection + MSA Amendment Routing",
                    data: {
                        isIncoming: false,
                        to: "bi-procurement@boehringer-ingelheim.com",
                        cc: "sophie.beaumont@ferring.com, legal-contracts@ferring.com, cfo-office@ferring.com",
                        subject: "PR-2026-01567 REJECTED — MSA Amendment Required Before Resubmission",
                        body: "Dear Boehringer Ingelheim Team,\n\nThank you for your response and for attaching the draft MSA Amendment No. 3.\n\nWe have reviewed the situation and confirm:\n   - The scope reduction path is not viable given Phase II protocol requirements\n   - MSA Amendment No. 3 (cap EUR 2,500,000 → EUR 2,900,000) is the correct resolution path\n\nPR-2026-01567 has been formally REJECTED in SAP Ariba pending execution of the MSA amendment.\n\nNext steps:\n   1. Draft MSA Amendment No. 3 has been routed to Ferring Legal (legal-contracts@ferring.com) and CFO Office (cfo-office@ferring.com) for review and signature\n   2. Estimated timeline: 10-15 business days\n   3. Once Amendment No. 3 is fully executed, Sophie Beaumont will resubmit PR-2026-01567\n\nReference: Validation run FPR-006 | ServiceNow: INC-2026-05102 | Rejection timestamp: 2026-03-26T14:22:00Z\n\nBest regards,\nFerring GmbH — Global Procurement\nsophie.beaumont@ferring.com"
                    }
                }
            ]
        },
        // STEP 14: SAP Ariba rejection
        {
            id: "step-14",
            title_p: "Desktop agent returning to SAP Ariba to reject PR-2026-01567...",
            title_s: "PR-2026-01567 status changed: Pending → Rejected in SAP Ariba",
            reasoning: [
                "Desktop agent re-authenticated to SAP Ariba",
                "Navigated to PR-2026-01567",
                "Clicked 'Reject' from approver actions menu",
                "Typed rejection comment: 'MSA-BI-2021-0044 annual cap EUR 2,500,000 exceeded by EUR 280,000 (+11.2%). MSA Amendment No. 3 required before approval. ServiceNow ref: INC-2026-05102. Resubmit after amendment execution. Ref: FPR-006.'",
                "Confirmed rejection — status: Pending Approval → Rejected",
                "Confirmation received (200 OK)"
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
                        pr_id: "PR-2026-01567",
                        action: "REJECT",
                        status_before: "Pending Approval",
                        status_after: "Rejected",
                        rejection_comment: "MSA-BI-2021-0044 annual cap EUR 2,500,000 exceeded by EUR 280,000 (+11.2%). MSA Amendment No. 3 required. Resubmit after amendment execution. Ref: FPR-006.",
                        timestamp: "2026-03-26T14:22:00Z",
                        confirmed_by: "Pace Automation Agent",
                        api_response: "200 OK"
                    }
                }
            ]
        },
        // STEP 15: Resolve ServiceNow ticket
        {
            id: "step-15",
            title_p: "Resolving ServiceNow ticket INC-2026-05102...",
            title_s: "ServiceNow INC-2026-05102 resolved — full resolution notes posted",
            reasoning: [
                "Returned to ServiceNow ticket INC-2026-05102",
                "Posted resolution comment: 'PR-2026-01567 validated and rejected. MSA-BI-2021-0044 annual cap exceeded by EUR 280,000. MSA Amendment No. 3 routed to Ferring Legal and CFO. PR to be resubmitted after amendment execution.'",
                "Ticket status updated: In Progress → Resolved",
                "Resolution code: 'Procurement — Escalated for contract amendment'",
                "Closure confirmation received"
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
                        resolution_comment: "PR-2026-01567 rejected. MSA cap exceedance EUR 280,000. MSA Amendment No. 3 required. Routed to Legal + CFO.",
                        resolved_by: "Pace Automation Agent",
                        timestamp: "2026-03-26T14:23:00Z"
                    }
                }
            ]
        },
        // STEP 16: Final audit trail
        {
            id: "step-16",
            title_p: "Generating complete audit trail...",
            title_s: "Process complete — PR-2026-01567 rejected, ServiceNow closed, MSA amendment routed",
            reasoning: [
                "Duration: 3m 10s (excluding HITL wait times)",
                "Systems accessed: ServiceNow, SAP Ariba, Ferring Supplier Master (3 systems)",
                "Attachments processed: 2 (MSA + SOW)",
                "Validations run: 14 — 12 passed, 1 failed, 1 informational",
                "HITL gates triggered: 2 (MSA resolution request + final rejection)",
                "Vendor interaction: 1 round — scope reduction declined, amendment proposed",
                "SAP Ariba final status: Rejected",
                "ServiceNow INC-2026-05102: Resolved",
                "MSA Amendment No. 3 draft routed to Ferring Legal + CFO"
            ],
            artifacts: [
                {
                    id: "audit-trail-6",
                    type: "json",
                    label: "Complete Audit Trail",
                    data: {
                        process_id: "FPR-006",
                        pr_id: "PR-2026-01567",
                        servicenow_ticket: "INC-2026-05102",
                        started: "2026-03-26T08:45:00Z",
                        completed: "2026-03-26T14:24:00Z",
                        outcome: "REJECTED",
                        systems_accessed: ["ServiceNow", "SAP Ariba", "Ferring Supplier Master"],
                        attachments_processed: 2,
                        validations: { run: 14, passed: 12, failed: 1 },
                        hitl_gates: 2,
                        vendor_rounds: 1,
                        sap_ariba_updated: true,
                        servicenow_resolved: true,
                        msa_amendment_routed: true
                    }
                }
            ]
        }
    ];

    for (let i = 0; i < allSteps.length; i++) {
        const step = allSteps[i];
        const isFinal = i === allSteps.length - 1;

        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: step.title_p,
            status: 'processing'
        });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        if (step.hitl === 'email') {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_s,
                status: 'warning',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            const gateLabel = step.hitl_gate === 2 ? 'HITL Gate 2: Final Rejection Email Pending' : 'HITL Gate 1: MSA Resolution Email Pending';
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', gateLabel);

            const hitlAction = await waitForHITL();

            if (hitlAction === 'send') {
                const sentTitle = step.hitl_gate === 2
                    ? 'Final rejection email sent — proceeding to SAP Ariba rejection'
                    : 'MSA resolution email sent to Boehringer — monitoring inbox for response';
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: sentTitle,
                    status: 'success',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', sentTitle);
            } else {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'Process halted by reviewer',
                    status: 'warning',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted by reviewer at HITL gate');
                return;
            }
            await delay(1500);

            if (step.hitl_gate === 1) {
                console.log("FPR_006: Simulating vendor response delay (3s)...");
                await delay(3000);
            }

        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: isFinal ? 'completed' : 'success',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
