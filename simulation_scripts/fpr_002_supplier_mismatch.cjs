const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_002";
const CASE_NAME = "Supplier & Pricing Mismatch";

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

// Per-process HITL: polls /hitl/FPR_002 until action='send' or 'reject'
const waitForHITL = async () => {
    console.log("FPR_002: Waiting for HITL action (send or reject)...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        await fetch(`${API_URL}/hitl/FPR_002`, {
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
            const r = await fetch(`${API_URL}/hitl/FPR_002`);
            const d = await r.json();
            if (d.action === 'send') { console.log("FPR_002: HITL resolved → send"); return 'send'; }
            if (d.action === 'reject') { console.log("FPR_002: HITL resolved → reject"); return 'reject'; }
        } catch (e) {}
        await delay(2000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    const steps = [
        // STEP 1: SAP Ariba login + navigate to PR
        {
            id: "step-1",
            title_p: "Desktop agent connecting to SAP Ariba...",
            title_s: "Connected to SAP Ariba — navigating to PR-2026-00912",
            reasoning: [
                "Logged in as pace.agent@ferring.com",
                "Session established (SESS-2026-03-26-0312)",
                "Navigating to Manage → Purchase Requisitions",
                "Searched for PR-2026-00912 in pending approvals queue",
                "PR-2026-00912 located — status: Pending Approval",
                "Opening PR detail view"
            ],
            artifacts: [
                {
                    id: "v-ariba-pr-2",
                    type: "video",
                    label: "SAP Ariba: PR-2026-00912 Data Pull",
                    videoPath: "/data/sap_ariba_pr_pull_fpr002.webm"
                }
            ]
        },
        // STEP 2: Read PR header fields
        {
            id: "step-2",
            title_p: "Reading PR-2026-00912 header fields...",
            title_s: "PR data extracted — Bachem AG, USD 45,800.00, India region",
            reasoning: [
                "Read Requester: Rajesh Krishnamurthy",
                "Read Budget Owner: Dr. Priya Nair",
                "Read Company Code: 2100 (Ferring Pharmaceuticals Pvt Ltd)",
                "Read Cost Center: CC-MFG-IN-092",
                "Read Currency: USD",
                "Read Total Amount: USD 45,800.00",
                "Read Supplier: Bachem AG (Supplier ID: SUP-72103)",
                "Read PR creation date: 2026-03-18",
                "Read Region: India (APAC)"
            ],
            artifacts: [
                {
                    id: "pr-header-2",
                    type: "json",
                    label: "PR Header Data",
                    data: {
                        pr_id: "PR-2026-00912",
                        company_code: "2100",
                        entity: "Ferring Pharmaceuticals Pvt Ltd",
                        requester: "Rajesh Krishnamurthy",
                        budget_owner: "Dr. Priya Nair",
                        po_owner: "Rajesh Krishnamurthy",
                        cost_center: "CC-MFG-IN-092",
                        currency: "USD",
                        total_amount: "45,800.00",
                        supplier_on_pr: "Bachem AG",
                        supplier_id: "SUP-72103",
                        region: "India (APAC)",
                        pr_date: "2026-03-18",
                        status: "Pending Approval"
                    }
                }
            ]
        },
        // STEP 3: Extract line items
        {
            id: "step-3",
            title_p: "Opening line items tab and reading each item...",
            title_s: "3 line items extracted — total matches PR header",
            reasoning: [
                "Clicked 'Line Items' tab in PR detail view",
                "Line 1: Fmoc-Val-OH — 500g × USD 38.40 = USD 19,200.00",
                "Line 2: Boc-Pro-OH — 250g × USD 72.00 = USD 18,000.00",
                "Line 3: Custom Peptide Synthesis — 1 LOT × USD 8,600.00 = USD 8,600.00",
                "Sum: USD 19,200 + USD 18,000 + USD 8,600 = USD 45,800.00 — matches PR total",
                "All 3 line items reference Material Group: MG-API-002"
            ],
            artifacts: [
                {
                    id: "line-items-2",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            { line: "1", description: "Fmoc-Val-OH (Peptide Building Block)", qty: "500g", unit_price: "USD 38.40", total: "USD 19,200.00", material_group: "MG-API-002" },
                            { line: "2", description: "Boc-Pro-OH (Amino Acid Derivative)", qty: "250g", unit_price: "USD 72.00", total: "USD 18,000.00", material_group: "MG-API-002" },
                            { line: "3", description: "Custom Peptide Synthesis — 1 LOT", qty: "1 LOT", unit_price: "USD 8,600.00", total: "USD 8,600.00", material_group: "MG-API-002" }
                        ],
                        sum_check: "USD 45,800.00 = PR total ✓"
                    }
                }
            ]
        },
        // STEP 4: Download + classify attachment
        {
            id: "step-4",
            title_p: "Downloading attachment from PR-2026-00912...",
            title_s: "Validation 1/14: Invoice identified (confidence: 0.92) — downloaded",
            reasoning: [
                "Clicked 'Attachments' tab in PR detail view",
                "Found 1 attachment: Bachem_Invoice_INV-2026-BH-11472.pdf (2 pages, 287KB)",
                "Document classification model applied",
                "Document type: Invoice (confidence: 0.92)",
                "Downloaded to processing queue for extraction"
            ],
            artifacts: [
                {
                    id: "pdf-2",
                    type: "file",
                    label: "Invoice — Bachem (INV-2026-BH-11472)",
                    pdfPath: "/data/bachem_invoice_2026.pdf"
                }
            ]
        },
        // STEP 5: Extract data from invoice
        {
            id: "step-5",
            title_p: "Extracting structured data from invoice...",
            title_s: "Data extracted — ALERT: Supplier name and amount discrepancies detected",
            reasoning: [
                "Extracted Supplier: Bachem Holding AG (invoice) vs Bachem AG (PR) — NAME MISMATCH",
                "Extracted Amount: USD 48,200.00 (invoice) vs USD 45,800.00 (PR) — PRICE MISMATCH (+USD 2,400, 5.24%)",
                "Extracted Invoice No: INV-2026-BH-11472",
                "Extracted Invoice Date: 18 March 2026",
                "Extracted Payment Terms: Net 30",
                "Extracted Bank: UBS AG, Account ending -4821"
            ],
            artifacts: [
                {
                    id: "extracted-2",
                    type: "json",
                    label: "Extracted Invoice Data (with mismatches)",
                    data: {
                        invoice_no: "INV-2026-BH-11472",
                        invoice_date: "2026-03-18",
                        supplier_on_invoice: "Bachem Holding AG",
                        supplier_on_pr: "Bachem AG",
                        supplier_match: "MISMATCH — name differs",
                        invoice_amount: "USD 48,200.00",
                        pr_amount: "USD 45,800.00",
                        price_variance: "+USD 2,400.00 (5.24%)",
                        price_match: "MISMATCH — invoice exceeds PR",
                        payment_terms: "Net 30",
                        currency: "USD"
                    }
                }
            ]
        },
        // STEP 6: Cross-check Supplier Master
        {
            id: "step-6",
            title_p: "Desktop agent opening Ferring Supplier Master to verify supplier identity...",
            title_s: "Supplier Master confirms: 'Bachem AG' (SUP-72103) is registered — 'Bachem Holding AG' is NOT",
            reasoning: [
                "Opened Ferring Supplier Master portal",
                "Searched for 'Bachem' — found 1 active record: SUP-72103: Bachem AG (Active, EMEA)",
                "No record found for 'Bachem Holding AG'",
                "Note: Bachem Holding AG is the parent company; Bachem AG is the registered trading entity",
                "Supplier name on invoice does NOT match any registered supplier name",
                "Supplier ID SUP-72103 is verified as 'Bachem AG' — invoices must use this exact name"
            ],
            artifacts: [
                {
                    id: "v-supplier-master-2",
                    type: "video",
                    label: "Ferring Supplier Master: Bachem lookup",
                    videoPath: "/data/supplier_master_fpr002.webm"
                },
                {
                    id: "supplier-master-result-2",
                    type: "json",
                    label: "Supplier Master Lookup Result",
                    data: {
                        search_term: "Bachem",
                        results: [
                            { supplier_id: "SUP-72103", name: "Bachem AG", status: "Active", registration_date: "2019-01-15", entity_type: "Trading Entity", region: "EMEA" }
                        ],
                        searched_for: "Bachem Holding AG",
                        found: false,
                        conclusion: "Bachem Holding AG is NOT a registered supplier. Bachem AG (SUP-72103) is the correct registered entity."
                    }
                }
            ]
        },
        // STEP 7: Run validation suite V2–V14
        {
            id: "step-7",
            title_p: "Running comprehensive validation suite (14 domains)...",
            title_s: "Validations complete — 11 PASS, 1 FAIL (Pricing), 1 FAIL (Supplier Name), 1 informational",
            reasoning: [
                "V1 Attachment: Invoice identified, confidence 0.92 — PASS",
                "V2 Accounting: Assignment K, CC-MFG-IN-092, GL 41200500 — PASS",
                "V3 Budget Owner: Dr. Priya Nair ≠ Rajesh Krishnamurthy (requester) — PASS",
                "V4 Currency: USD matches throughout PR and invoice — PASS",
                "V5 Material Group: MG-API-002 valid in approved master list — PASS",
                "V6 Supplier: FAIL — Invoice 'Bachem Holding AG' vs PR 'Bachem AG'; Supplier Master confirms 'Bachem AG' is correct registered entity",
                "V7 Pricing: FAIL — Invoice USD 48,200 vs PR USD 45,800 (variance +5.24%, threshold ±3%)",
                "V8 Service Type: SAC 998599 valid — PASS",
                "V9 Ordering: EMAIL method, orders@bachem.com valid — PASS",
                "V10 Ship-To: SHIP-IN-003 linked to entity 2100 — PASS",
                "V11 Sold-To: 2100 = 2100 — PASS",
                "V12 Company Code: Ferring Pharmaceuticals Pvt Ltd, confidence 0.99 — PASS",
                "V13 Quantity: All 3 line items match at Level 2 — PASS",
                "V14 Deliver-To: Ferring API Manufacturing, Plot 47, Bangalore — PASS"
            ],
            artifacts: [
                {
                    id: "validation-scorecard-2",
                    type: "json",
                    label: "Validation Scorecard",
                    data: {
                        overall_status: "FAIL",
                        total: 14, passed: 11, failed: 2, informational: 1,
                        failures: [
                            { check: "V6 Supplier Name", result: "FAIL", detail: "Invoice: Bachem Holding AG | PR/Master: Bachem AG" },
                            { check: "V7 Pricing", result: "FAIL", detail: "Invoice: USD 48,200 | PR: USD 45,800 | Variance: +5.24%" }
                        ],
                        informational: [{ check: "V3 Budget Owner", note: "Dr. Priya Nair is budget owner — distinct from requester Rajesh Krishnamurthy ✓" }]
                    }
                }
            ]
        },
        // STEP 8: Generate gap analysis
        {
            id: "step-8",
            title_p: "Generating validation summary and gap analysis...",
            title_s: "Overall status: FAIL — 2 critical issues require vendor correction",
            reasoning: [
                "Issue 1 (Critical): Supplier name mismatch — invoice from 'Bachem Holding AG' but registered supplier is 'Bachem AG' per Supplier Master SUP-72103",
                "Issue 2 (Critical): Pricing variance — invoice USD 48,200 exceeds PR amount USD 45,800 by USD 2,400 (5.24%) — exceeds ±3% tolerance",
                "Recommendation: Draft email to vendor requesting corrected invoice with both issues addressed",
                "Note: Supplier name correction alone is insufficient — pricing must also be resolved"
            ],
            artifacts: [
                {
                    id: "gap-analysis-2",
                    type: "json",
                    label: "Gap Analysis Summary",
                    data: {
                        pr_id: "PR-2026-00912",
                        overall_status: "FAIL",
                        issues: [
                            { id: "ISSUE-1", severity: "Critical", type: "Supplier Name Mismatch", description: "Invoice shows 'Bachem Holding AG'; Ferring Supplier Master requires 'Bachem AG' (SUP-72103)" },
                            { id: "ISSUE-2", severity: "Critical", type: "Pricing Variance", description: "Invoice USD 48,200.00 exceeds PR USD 45,800.00 by USD 2,400 (+5.24%)" }
                        ],
                        recommended_action: "Email vendor requesting corrected invoice addressing both issues"
                    }
                }
            ]
        }
    ];

    // STEPS 9-14 defined separately to keep code clear
    const hitlSteps = [
        // STEP 9: HITL GATE 1 — Email to vendor
        {
            id: "step-9",
            hitl: "email",
            hitl_gate: 1,
            title_p: "Drafting email to vendor requesting corrected invoice...",
            title_s: "Email draft ready — awaiting approval to send",
            reasoning: [
                "Email to: orders@bachem.com",
                "CC: rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                "Subject: Correction Required — Invoice INV-2026-BH-11472 for PR-2026-00912",
                "Body includes both discrepancies: supplier name + pricing",
                "Requests corrected invoice with Bachem AG as supplier and amount aligned to PR",
                "Awaiting procurement team approval to send"
            ],
            artifacts: [
                {
                    id: "email-draft-2-gate1",
                    type: "email_draft",
                    label: "Email Draft: Vendor Correction Request",
                    data: {
                        isIncoming: false,
                        to: "orders@bachem.com",
                        cc: "rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                        subject: "Correction Required — Invoice INV-2026-BH-11472 for PR-2026-00912",
                        body: "Dear Bachem AG Team,\n\nWe have received Invoice INV-2026-BH-11472 dated 18 March 2026 in connection with Purchase Requisition PR-2026-00912 (Ferring Pharmaceuticals Pvt Ltd, India).\n\nOur automated validation has identified two issues that must be corrected before this invoice can be approved:\n\n1. SUPPLIER NAME DISCREPANCY:\n   - Invoice issued by: Bachem Holding AG\n   - Registered supplier in Ferring Supplier Master: Bachem AG (ID: SUP-72103)\n   Please reissue the invoice with the correct legal entity name 'Bachem AG' to match our supplier registration.\n\n2. PRICING DISCREPANCY:\n   - Invoice amount: USD 48,200.00\n   - PR-2026-00912 approved amount: USD 45,800.00\n   - Variance: USD 2,400.00 (+5.24%)\n   Please reissue at USD 45,800.00 or provide supporting documentation for the difference.\n\nKindly reissue a corrected invoice addressing both points and reply to this email. Processing will resume upon receipt.\n\nBest regards,\nFerring Procurement Automation Team\nprocurement-india@ferring.com"
                    }
                }
            ]
        },
        // STEP 10: Vendor response received
        {
            id: "step-10",
            title_p: "Monitoring inbox for vendor response...",
            title_s: "Vendor response received — updated invoice attached",
            reasoning: [
                "Email received from orders@bachem.com at 14:32 UTC",
                "Subject: RE: Correction Required — Invoice INV-2026-BH-11472",
                "Vendor states: 'We have corrected the supplier name to Bachem AG as per your registration records. Please find updated invoice INV-2026-BH-11472-v2 attached.'",
                "Vendor note: 'Regarding the price difference — our cost base for the Custom Peptide Synthesis LOT has increased. We are unable to reduce below USD 48,200.'",
                "Attachment: Bachem_Invoice_INV-2026-BH-11472_v2.pdf (2 pages, 291KB)",
                "Downloading updated invoice to processing queue"
            ],
            artifacts: [
                {
                    id: "vendor-reply-2",
                    type: "email_draft",
                    label: "Incoming: Vendor Reply with Updated Invoice",
                    data: {
                        isIncoming: true,
                        from: "orders@bachem.com",
                        to: "procurement-india@ferring.com",
                        subject: "RE: Correction Required — Invoice INV-2026-BH-11472",
                        body: "Dear Ferring Procurement Team,\n\nThank you for your message. We have corrected the supplier name on the invoice from 'Bachem Holding AG' to 'Bachem AG' as per your supplier registration records.\n\nRegarding the pricing: unfortunately we are unable to reduce the invoice amount below USD 48,200.00. Our raw material costs for the Custom Peptide Synthesis lot have increased and this is reflected in the invoice. We have attached the updated invoice INV-2026-BH-11472-v2 with the corrected supplier name.\n\nPlease let us know if you require further documentation.\n\nBest regards,\nBachem AG — Order Management\norders@bachem.com"
                    }
                }
            ]
        },
        // STEP 11: Re-validate updated invoice
        {
            id: "step-11",
            title_p: "Extracting data from updated invoice and re-validating...",
            title_s: "Updated invoice: Supplier name FIXED ✓ — Price STILL MISMATCHED ✗ (USD 48,200 vs USD 45,800)",
            reasoning: [
                "Updated Invoice Supplier: Bachem AG — NOW MATCHES PR and Supplier Master ✓",
                "Updated Invoice Amount: USD 48,200.00 — STILL EXCEEDS PR by USD 2,400 (5.24%) ✗",
                "Re-running validation suite on updated invoice...",
                "Re-validation V6 Supplier: PASS — 'Bachem AG' matches Supplier Master SUP-72103",
                "Re-validation V7 Pricing: FAIL — amount USD 48,200 still exceeds PR USD 45,800 by 5.24%",
                "Overall result: STILL FAIL — supplier name corrected but pricing discrepancy persists"
            ],
            artifacts: [
                {
                    id: "revalidation-comparison-2",
                    type: "json",
                    label: "Before/After Validation Comparison",
                    data: {
                        v6_supplier: { before: "FAIL (Bachem Holding AG)", after: "PASS (Bachem AG — matches SUP-72103)", changed: true },
                        v7_pricing: { before: "FAIL (USD 48,200 vs USD 45,800)", after: "FAIL (USD 48,200 vs USD 45,800 — unchanged)", changed: false },
                        overall: { before: "FAIL (2 issues)", after: "FAIL (1 issue remains)", net_resolved: 1, net_remaining: 1 },
                        conclusion: "Pricing discrepancy of USD 2,400 (+5.24%) unresolved — PR cannot proceed"
                    }
                }
            ]
        },
        // STEP 12: HITL GATE 2 — Final rejection email
        {
            id: "step-12",
            hitl: "email",
            hitl_gate: 2,
            title_p: "Drafting final rejection email with specific pricing justification...",
            title_s: "Rejection email drafted — awaiting approval to send",
            reasoning: [
                "Email to: orders@bachem.com, rajesh.krishnamurthy@ferring.com",
                "Subject: PR-2026-00912 REJECTED — Pricing Discrepancy Unresolved",
                "Acknowledges supplier name fix (thank you)",
                "States clearly: USD 48,200 still exceeds PR USD 45,800 by USD 2,400 (5.24%)",
                "Explains: PR must be amended or invoice must match before processing can continue",
                "Awaiting approval to send final rejection"
            ],
            artifacts: [
                {
                    id: "email-draft-2-gate2",
                    type: "email_draft",
                    label: "Email Draft: Final Rejection Notice",
                    data: {
                        isIncoming: false,
                        to: "orders@bachem.com",
                        cc: "rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                        subject: "PR-2026-00912 REJECTED — Pricing Discrepancy Unresolved",
                        body: "Dear Bachem AG Team,\n\nThank you for reissuing Invoice INV-2026-BH-11472-v2 with the corrected supplier name. The supplier name now matches our records (Bachem AG, SUP-72103).\n\nHowever, we are unable to approve Purchase Requisition PR-2026-00912 at this time. The pricing discrepancy remains unresolved:\n\n   Invoice Amount (v2): USD 48,200.00\n   PR-2026-00912 Amount: USD 45,800.00\n   Variance: USD 2,400.00 (+5.24%)\n\nFerring's procurement policy requires invoice amounts to be within ±3% of the approved PR amount. The current variance of 5.24% exceeds this threshold.\n\nPR-2026-00912 has been formally REJECTED in SAP Ariba. To proceed, one of the following actions is required:\n   a) Reissue the invoice at USD 45,800.00, or\n   b) Requester Rajesh Krishnamurthy submits an amended PR for USD 48,200.00 with business justification for the cost increase.\n\nReference: Validation run FPR-002 | Rejection timestamp: 2026-03-26T14:45:00Z\n\nBest regards,\nFerring Procurement Automation Team\nprocurement-india@ferring.com"
                    }
                }
            ]
        },
        // STEP 13: SAP Ariba rejection
        {
            id: "step-13",
            title_p: "Desktop agent returning to SAP Ariba to reject PR-2026-00912...",
            title_s: "PR-2026-00912 status changed: Pending → Rejected in SAP Ariba",
            reasoning: [
                "Desktop agent re-authenticated to SAP Ariba (session re-established)",
                "Searched and opened PR-2026-00912",
                "Clicked 'Reject' action from approver actions menu",
                "Typed rejection comment: 'Invoice pricing mismatch: USD 48,200 vs PR USD 45,800 (variance +5.24%, exceeds ±3% threshold). Supplier name corrected in v2 invoice but pricing unresolved. Vendor informed. Reference: Validation run FPR-002.'",
                "Confirmed rejection — status changed: Pending Approval → Rejected",
                "System confirmation received (200 OK)"
            ],
            artifacts: [
                {
                    id: "v-ariba-reject-2",
                    type: "video",
                    label: "SAP Ariba: PR-2026-00912 Rejection",
                    videoPath: "/data/sap_ariba_rejection_fpr002.webm"
                },
                {
                    id: "ariba-rejection-confirm-2",
                    type: "json",
                    label: "SAP Ariba Rejection Confirmation",
                    data: {
                        pr_id: "PR-2026-00912",
                        action: "REJECT",
                        status_before: "Pending Approval",
                        status_after: "Rejected",
                        rejection_comment: "Invoice pricing mismatch: USD 48,200 vs PR USD 45,800 (variance +5.24%, exceeds ±3% threshold). Supplier name corrected in v2 invoice but pricing unresolved. Vendor informed. Reference: Validation run FPR-002.",
                        timestamp: "2026-03-26T14:45:33Z",
                        confirmed_by: "Pace Automation Agent",
                        api_response: "200 OK"
                    }
                }
            ]
        },
        // STEP 14: Audit trail
        {
            id: "step-14",
            title_p: "Generating complete audit trail...",
            title_s: "Process complete — PR-2026-00912 rejected with full audit trail",
            reasoning: [
                "Duration: 2m 15s (excluding HITL wait times)",
                "Validations run: 14 — 11 passed, 2 failed, 1 informational",
                "HITL gates triggered: 2 (correction request sent + final rejection sent)",
                "Vendor interaction: 1 round trip — partial fix (supplier name corrected, price unchanged)",
                "Supplier Master lookup: completed — Bachem AG SUP-72103 confirmed",
                "SAP Ariba final status: Rejected",
                "All artifacts archived for compliance and audit"
            ],
            artifacts: [
                {
                    id: "audit-trail-2",
                    type: "json",
                    label: "Complete Audit Trail",
                    data: {
                        process_id: "FPR-002",
                        pr_id: "PR-2026-00912",
                        started: "2026-03-26T09:18:00Z",
                        completed: "2026-03-26T14:46:00Z",
                        outcome: "REJECTED",
                        validations: { run: 14, passed: 11, failed: 2 },
                        hitl_gates: 2,
                        vendor_rounds: 1,
                        supplier_master_checked: true,
                        sap_ariba_updated: true
                    }
                }
            ]
        }
    ];

    const allSteps = [...steps, ...hitlSteps];

    for (let i = 0; i < allSteps.length; i++) {
        const step = allSteps[i];
        const isFinal = i === allSteps.length - 1;

        // Show processing state
        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: step.title_p,
            status: 'processing'
        });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        if (step.hitl === 'email') {
            // Show warning + draft, then BLOCK on HITL
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_s,
                status: 'warning',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            const gateLabel = step.hitl_gate === 2 ? 'HITL Gate 2: Final Rejection Email Pending' : 'HITL Gate 1: Correction Email Pending';
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', gateLabel);

            // BLOCK until human approves
            const hitlAction = await waitForHITL();

            if (hitlAction === 'send') {
                const sentTitle = step.hitl_gate === 2
                    ? 'Final rejection email sent — proceeding to SAP Ariba rejection'
                    : 'Vendor correction email sent — monitoring inbox for response';
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

            // After HITL gate 1: simulate vendor response delay before step 10
            if (step.hitl_gate === 1) {
                console.log("FPR_002: Simulating vendor response delay (3s)...");
                await delay(3000);
            }

        } else {
            // Normal step
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
