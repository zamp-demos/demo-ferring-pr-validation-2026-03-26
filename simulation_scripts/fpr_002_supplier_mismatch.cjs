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

    const steps = [

        // ── STAGE 1: Regional Queue Management ──────────────────────────────
        {
            id: "step-1",
            title_p: "Accessing SAP Ariba pending approvals queue...",
            title_s: "SAP Ariba queue: 4 pending PRs found — selected PR-2026-00912 (FIFO)",
            reasoning: [
                "Agent accesses SAP Ariba as pace.agent@ferring.com",
                "Queried pending approvals for Zamp.ai_test — 4 PRs in queue",
                "FIFO selection: oldest unprocessed PR is PR-2026-00912 (created 2026-03-18)",
                "PR-2026-00912: Bachem AG, USD 45,800.00, Company Code 2100, India region",
                "Selected PR-2026-00912 for processing"
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

        // ── STAGE 2: Authentication and PR Retrieval ─────────────────────────
        {
            id: "step-2",
            title_p: "Authenticating to SAP Ariba and retrieving PR details...",
            title_s: "Connected to SAP Ariba — PR-2026-00912 opened, Bachem AG, USD 45,800.00",
            reasoning: [
                "Authenticated as pace.agent@ferring.com — session established (SESS-2026-03-26-0312)",
                "Navigated to Manage → Purchase Requisitions",
                "Opened PR-2026-00912 detail view — status: Pending Approval",
                "Read Requester: Rajesh Krishnamurthy",
                "Read Budget Owner: Dr. Priya Nair",
                "Read Company Code: 2100 (Ferring Pharmaceuticals Pvt Ltd)",
                "Read PO Owner: Rajesh Krishnamurthy",
                "Read Cost Center: CC-MFG-IN-092",
                "Read Currency: USD — Total Amount: USD 45,800.00",
                "Read Supplier: Bachem AG (Supplier ID: SUP-72103)",
                "Read Region: India (APAC) — PR date: 2026-03-18"
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
                        supplier: "Bachem AG",
                        supplier_id: "SUP-72103",
                        region: "India (APAC)",
                        pr_date: "2026-03-18",
                        line_items_count: 3,
                        status: "Pending Approval"
                    }
                }
            ]
        },

        // ── STAGE 3: Data Extraction and Transformation ──────────────────────
        {
            id: "step-3",
            title_p: "Extracting PR data — header fields, line items, and supplier enrichment...",
            title_s: "3 line items extracted — USD 45,800.00 total, supplier enriched via Supplier Master",
            reasoning: [
                "Clicked Line Items tab in PR detail view",
                "Line 1: Fmoc-Val-OH (Peptide Building Block) — 500g × USD 38.40 = USD 19,200.00, MG-API-002",
                "Line 2: Boc-Pro-OH (Amino Acid Derivative) — 250g × USD 72.00 = USD 18,000.00, MG-API-002",
                "Line 3: Custom Peptide Synthesis — 1 LOT × USD 8,600.00 = USD 8,600.00, MG-API-002",
                "Sum check: USD 19,200 + USD 18,000 + USD 8,600 = USD 45,800.00 — matches PR header ✓",
                "Supplier Master enrichment: looked up SUP-72103 in master DB",
                "Retrieved registered name: 'Bachem AG', status: Active, ordering method: EMAIL (orders@bachem.com)",
                "Retrieved payment terms: Net 30, region: EMEA, registration date: 2019-01-15",
                "Supplier status confirmed: Active — no purchasing blocks, no compliance flags"
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
                        sum_check: "USD 45,800.00 = PR header total ✓",
                        supplier_enrichment: {
                            supplier_id: "SUP-72103",
                            registered_name: "Bachem AG",
                            status: "Active",
                            ordering_method: "EMAIL",
                            ordering_email: "orders@bachem.com",
                            payment_terms: "Net 30",
                            region: "EMEA",
                            registration_date: "2019-01-15",
                            purchasing_blocks: "None",
                            compliance_flags: "None"
                        }
                    }
                }
            ]
        },

        // ── STAGE 4: Attachment Processing (Validation 1/14) ─────────────────
        {
            id: "step-4",
            title_p: "Checking attachments tab — downloading and classifying documents...",
            title_s: "Validation 1/14: Invoice identified (confidence: 0.92) — downloaded",
            reasoning: [
                "Clicked Attachments tab in PR detail view",
                "Found 1 attachment: Bachem_Invoice_INV-2026-BH-11472.pdf (2 pages, 287KB)",
                "Document classification model applied",
                "Document type: Invoice — confidence: 0.92",
                "Downloaded to processing queue for structured data extraction"
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

        // ── STAGE 5: Structured Data Extraction from Document ────────────────
        {
            id: "step-5",
            title_p: "Extracting structured data from invoice...",
            title_s: "Structured data extracted — ALERT: supplier name and amount discrepancies detected",
            reasoning: [
                "Extracted Supplier Name: 'Bachem Holding AG' (invoice) vs 'Bachem AG' (PR) — NAME MISMATCH",
                "Extracted Invoice Amount: USD 48,200.00 (invoice) vs USD 45,800.00 (PR) — PRICE MISMATCH (+USD 2,400 / +5.24%)",
                "Extracted Invoice No: INV-2026-BH-11472",
                "Extracted Invoice Date: 18 March 2026",
                "Extracted Payment Terms: Net 30",
                "Extracted Bank: UBS AG, account ending -4821",
                "Key findings: supplier entity name differs; invoice total exceeds PR by 5.24%"
            ],
            artifacts: [
                {
                    id: "extracted-2",
                    type: "json",
                    label: "Extracted Invoice Data (with discrepancies)",
                    data: {
                        invoice_no: "INV-2026-BH-11472",
                        invoice_date: "2026-03-18",
                        supplier_on_invoice: "Bachem Holding AG",
                        supplier_on_pr: "Bachem AG",
                        supplier_match: "MISMATCH — entity name differs",
                        invoice_amount: "USD 48,200.00",
                        pr_amount: "USD 45,800.00",
                        price_variance: "+USD 2,400.00 (+5.24%)",
                        price_match: "MISMATCH — invoice exceeds PR by 5.24%",
                        payment_terms: "Net 30",
                        currency: "USD",
                        bank: "UBS AG, account ending -4821"
                    }
                }
            ]
        },

        // ── STAGE 6a: Comprehensive Validation V2–V8 ─────────────────────────
        {
            id: "step-6a",
            title_p: "Running validation domains 2–8...",
            title_s: "Validations 2–5 PASS — V6 Supplier FAIL — V7 Pricing FAIL — V8 PASS",
            reasoning: [
                "V2 Accounting: Assignment K, Cost Center CC-MFG-IN-092, GL 41200500 — consistent ✓ PASS",
                "V3 Budget Owner: Dr. Priya Nair ≠ Rajesh Krishnamurthy (requester) — segregation confirmed ✓ PASS",
                "V4 Currency: USD consistent across PR, line items, and invoice ✓ PASS",
                "V5 Material Group: MG-API-002 present in approved master list ✓ PASS",
                "V6 Supplier: FAIL — invoice shows 'Bachem Holding AG'; Supplier Master SUP-72103 is registered as 'Bachem AG'; no record exists for 'Bachem Holding AG'",
                "V7 Pricing: FAIL — invoice USD 48,200.00 vs PR USD 45,800.00; variance +5.24% exceeds ±3% tolerance",
                "V8 Service Type: SAC 998599 valid for peptide/API materials ✓ PASS"
            ],
            artifacts: [
                {
                    id: "val-v2-v8-2",
                    type: "json",
                    label: "Validation Results V2–V8",
                    data: {
                        V2_Accounting: "PASS",
                        V3_BudgetOwner: "PASS",
                        V4_Currency: "PASS",
                        V5_MaterialGroup: "PASS",
                        V6_SupplierID: { result: "FAIL", detail: "Invoice: Bachem Holding AG | Supplier Master SUP-72103: Bachem AG — no record for Bachem Holding AG" },
                        V7_Pricing: { result: "FAIL", detail: "Invoice: USD 48,200.00 | PR: USD 45,800.00 | Variance: +USD 2,400.00 (+5.24%) | Threshold: ±3%" },
                        V8_ServiceType: "PASS"
                    }
                }
            ]
        },

        // ── STAGE 6b: Comprehensive Validation V9–V14 ────────────────────────
        {
            id: "step-6b",
            title_p: "Running validation domains 9–14...",
            title_s: "Validations 9–14 all PASS — overall result: FAIL (V6 Supplier, V7 Pricing)",
            reasoning: [
                "V9 Ordering Method: EMAIL, orders@bachem.com — valid per Supplier Master ✓ PASS",
                "V10 Ship-To: SHIP-IN-003 linked to entity 2100 (Ferring Pharmaceuticals Pvt Ltd) ✓ PASS",
                "V11 Sold-To: 2100 = 2100 — exact match ✓ PASS",
                "V12 Company Code: Ferring Pharmaceuticals Pvt Ltd, confidence 0.99 ✓ PASS",
                "V13 Quantity: all 3 line items verified at Level 2 (sum and unit checks) ✓ PASS",
                "V14 Deliver-To: Ferring API Manufacturing, Plot 47, Bangalore — valid for CC-MFG-IN-092 ✓ PASS",
                "Overall: 11 PASS, 2 FAIL (V6 Supplier Name, V7 Pricing), 1 informational (V3 Budget Owner segregation noted)"
            ],
            artifacts: [
                {
                    id: "val-v9-v14-2",
                    type: "json",
                    label: "Validation Results V9–V14 + Scorecard",
                    data: {
                        V9_OrderingMethod: "PASS",
                        V10_ShipTo: "PASS",
                        V11_SoldTo: "PASS",
                        V12_CompanyCode: "PASS",
                        V13_Quantity: "PASS",
                        V14_DeliverTo: "PASS",
                        scorecard: {
                            overall_status: "FAIL",
                            total: 14, passed: 11, failed: 2, informational: 1,
                            failures: [
                                { check: "V6 Supplier Name", result: "FAIL", detail: "Invoice: Bachem Holding AG | PR/Master: Bachem AG — entity not registered" },
                                { check: "V7 Pricing", result: "FAIL", detail: "Invoice: USD 48,200.00 | PR: USD 45,800.00 | Variance: +5.24% (threshold ±3%)" }
                            ]
                        }
                    }
                }
            ]
        },

        // ── STAGE 7: Draft Correction Email ──────────────────────────────────
        {
            id: "step-7",
            title_p: "Overall status: FAIL — drafting correction email to vendor...",
            title_s: "2 critical issues identified — correction email drafted for both supplier name and pricing",
            reasoning: [
                "Issue 1 (Critical): Supplier name mismatch — invoice from 'Bachem Holding AG', registered entity is 'Bachem AG' (SUP-72103)",
                "Issue 2 (Critical): Pricing variance — invoice USD 48,200.00 exceeds PR USD 45,800.00 by USD 2,400.00 (+5.24%); threshold is ±3%",
                "Action: drafting correction email to orders@bachem.com requesting reissued invoice addressing both issues",
                "Email copied to requester Rajesh Krishnamurthy and procurement-india@ferring.com",
                "Awaiting procurement team approval before sending"
            ]
        },

        // ── STAGE 8: HITL Gate 1 — Approve correction email ──────────────────
        {
            id: "step-8",
            hitl: true,
            hitl_gate: 1,
            title_p: "Requesting approval to send correction email to Bachem AG...",
            title_s: "Correction email ready — awaiting approval to send",
            reasoning: [
                "Email to: orders@bachem.com",
                "CC: rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                "Subject: Correction Required — Invoice INV-2026-BH-11472 for PR-2026-00912",
                "Body details both issues: supplier entity name and pricing variance",
                "Requests corrected invoice with 'Bachem AG' as entity and amount aligned to USD 45,800.00",
                "Awaiting procurement team approval to send"
            ],
            artifacts: [
                {
                    id: "email-draft-2-gate1",
                    type: "email_draft",
                    label: "Email Draft: Vendor Correction Request (Gate 1)",
                    data: {
                        isIncoming: false,
                        to: "orders@bachem.com",
                        cc: "rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                        subject: "Correction Required — Invoice INV-2026-BH-11472 for PR-2026-00912",
                        body: "Dear Bachem AG Team,\n\nWe have received Invoice INV-2026-BH-11472 dated 18 March 2026 in connection with Purchase Requisition PR-2026-00912 (Ferring Pharmaceuticals Pvt Ltd, India).\n\nOur automated validation has identified two issues that must be corrected before this invoice can be approved:\n\n1. SUPPLIER NAME DISCREPANCY:\n   Invoice issued by: Bachem Holding AG\n   Registered supplier in Ferring Supplier Master: Bachem AG (ID: SUP-72103)\n   Please reissue the invoice with the correct legal entity name 'Bachem AG'.\n\n2. PRICING DISCREPANCY:\n   Invoice amount: USD 48,200.00\n   PR-2026-00912 approved amount: USD 45,800.00\n   Variance: USD 2,400.00 (+5.24%)\n   Please reissue at USD 45,800.00 or provide supporting documentation for the difference.\n\nKindly reissue a corrected invoice addressing both points and reply to this email.\n\nBest regards,\nFerring Procurement Automation Team\nprocurement-india@ferring.com"
                    }
                }
            ]
        },

        // ── Post Gate 1: Vendor response ─────────────────────────────────────
        {
            id: "step-8b",
            title_p: "Monitoring inbox for vendor response...",
            title_s: "Vendor response received — updated invoice attached",
            reasoning: [
                "Email received from orders@bachem.com at 14:32 UTC",
                "Subject: RE: Correction Required — Invoice INV-2026-BH-11472",
                "Vendor confirms: corrected supplier name to 'Bachem AG' as per Ferring registration",
                "Vendor note: unable to reduce price below USD 48,200.00 — raw material costs have increased",
                "Attachment: Bachem_Invoice_INV-2026-BH-11472_v2.pdf (2 pages, 291KB) — downloaded",
                "Proceeding to re-validate updated invoice"
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
                        body: "Dear Ferring Procurement Team,\n\nThank you for your message. We have corrected the supplier name on the invoice from 'Bachem Holding AG' to 'Bachem AG' as per your supplier registration records.\n\nRegarding the pricing: unfortunately we are unable to reduce the invoice amount below USD 48,200.00. Our raw material costs for the Custom Peptide Synthesis lot have increased and this is reflected in the invoice. Please find attached the updated invoice INV-2026-BH-11472-v2 with the corrected supplier name.\n\nBest regards,\nBachem AG — Order Management\norders@bachem.com"
                    }
                }
            ]
        },

        // ── Re-validate updated invoice ───────────────────────────────────────
        {
            id: "step-8c",
            title_p: "Re-validating updated invoice from Bachem AG...",
            title_s: "Re-validation: V6 Supplier FIXED ✓ — V7 Pricing STILL FAIL (USD 48,200 vs USD 45,800)",
            reasoning: [
                "Re-validation V6 Supplier: PASS — updated invoice now shows 'Bachem AG' matching SUP-72103 ✓",
                "Re-validation V7 Pricing: FAIL — amount USD 48,200.00 unchanged; still exceeds PR by USD 2,400.00 (+5.24%)",
                "Net result: 1 issue resolved (supplier name), 1 issue persists (pricing variance)",
                "PR cannot be approved — pricing variance exceeds ±3% policy threshold",
                "Next action: formal rejection of PR-2026-00912, notify vendor and requester"
            ],
            artifacts: [
                {
                    id: "revalidation-2",
                    type: "json",
                    label: "Re-validation Comparison (v1 vs v2 invoice)",
                    data: {
                        V6_Supplier: { v1: "FAIL (Bachem Holding AG)", v2: "PASS (Bachem AG — matches SUP-72103)", resolved: true },
                        V7_Pricing: { v1: "FAIL (USD 48,200 vs USD 45,800)", v2: "FAIL (USD 48,200 vs USD 45,800 — unchanged)", resolved: false },
                        overall: { v1: "FAIL (2 issues)", v2: "FAIL (1 issue remains)", net_resolved: 1, net_remaining: 1 },
                        conclusion: "Pricing discrepancy of USD 2,400.00 (+5.24%) unresolved — PR cannot proceed"
                    }
                }
            ]
        },

        // ── STAGE 8b: HITL Gate 2 — Approve rejection email ──────────────────
        {
            id: "step-9",
            hitl: true,
            hitl_gate: 2,
            title_p: "Drafting final rejection email — awaiting approval to send...",
            title_s: "Rejection email ready — awaiting approval to send",
            reasoning: [
                "Email to: orders@bachem.com",
                "CC: rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                "Subject: PR-2026-00912 REJECTED — Pricing Discrepancy Unresolved",
                "Acknowledges supplier name correction in v2 invoice",
                "States clearly: USD 48,200.00 still exceeds PR USD 45,800.00 by USD 2,400.00 (+5.24%)",
                "Options: reissue at USD 45,800.00, or requester submits amended PR with business justification",
                "Awaiting procurement team approval to send final rejection"
            ],
            artifacts: [
                {
                    id: "email-draft-2-gate2",
                    type: "email_draft",
                    label: "Email Draft: Final Rejection Notice (Gate 2)",
                    data: {
                        isIncoming: false,
                        to: "orders@bachem.com",
                        cc: "rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                        subject: "PR-2026-00912 REJECTED — Pricing Discrepancy Unresolved",
                        body: "Dear Bachem AG Team,\n\nThank you for reissuing Invoice INV-2026-BH-11472-v2 with the corrected supplier name. The name now matches our records (Bachem AG, SUP-72103).\n\nHowever, we are unable to approve Purchase Requisition PR-2026-00912. The pricing discrepancy remains unresolved:\n\n   Invoice Amount (v2): USD 48,200.00\n   PR-2026-00912 Amount: USD 45,800.00\n   Variance: USD 2,400.00 (+5.24%)\n\nFerring's procurement policy requires invoice amounts to be within ±3% of the approved PR amount. The current variance of 5.24% exceeds this threshold.\n\nPR-2026-00912 has been formally REJECTED in SAP Ariba. To proceed, one of the following actions is required:\n   a) Reissue the invoice at USD 45,800.00, or\n   b) Requester Rajesh Krishnamurthy submits an amended PR for USD 48,200.00 with business justification.\n\nReference: Validation run FPR-002 | Rejection timestamp: 2026-03-26T14:45:00Z\n\nBest regards,\nFerring Procurement Automation Team\nprocurement-india@ferring.com"
                    }
                }
            ]
        },

        // ── STAGE 9: Reject in SAP Ariba ─────────────────────────────────────
        {
            id: "step-10",
            title_p: "Rejecting PR-2026-00912 in SAP Ariba...",
            title_s: "PR-2026-00912 status changed: Pending Approval → Rejected in SAP Ariba",
            reasoning: [
                "Desktop agent re-authenticated to SAP Ariba (session re-established)",
                "Opened PR-2026-00912 from pending approvals",
                "Selected 'Reject' from approver actions menu",
                "Rejection comment: 'Invoice pricing mismatch: USD 48,200.00 vs PR USD 45,800.00 (variance +5.24%, exceeds ±3% threshold). Supplier name corrected in v2 invoice but pricing unresolved. Vendor informed. Reference: Validation run FPR-002.'",
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
                        rejection_comment: "Invoice pricing mismatch: USD 48,200.00 vs PR USD 45,800.00 (variance +5.24%, exceeds ±3% threshold). Supplier name corrected in v2 invoice but pricing unresolved. Vendor informed. Reference: Validation run FPR-002.",
                        timestamp: "2026-03-26T14:45:33Z",
                        confirmed_by: "Pace Automation Agent",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 9: Audit Trail ──────────────────────────────────────────────
        {
            id: "step-11",
            title_p: "Generating complete audit trail...",
            title_s: "Process complete — PR-2026-00912 rejected, full audit trail archived",
            reasoning: [
                "Processing duration: 2m 15s (excluding HITL wait times)",
                "Validations run: 14 — 11 passed, 2 failed (V6 Supplier, V7 Pricing), 1 informational",
                "HITL gates triggered: 2 (Gate 1: correction email to vendor; Gate 2: rejection email)",
                "Vendor interaction: 1 round trip — supplier name corrected, pricing unresolved",
                "Supplier Master lookup completed: Bachem AG SUP-72103 confirmed as registered entity",
                "SAP Ariba final status: Rejected",
                "All artifacts archived for compliance and audit"
            ],
            artifacts: [
                {
                    id: "audit-trail-2",
                    type: "json",
                    label: "Complete Audit Trail",
                    data: {
                        process_id: "FPR_002",
                        pr_id: "PR-2026-00912",
                        supplier: "Bachem AG (SUP-72103)",
                        amount: "USD 45,800.00",
                        started: "2026-03-26T09:18:00Z",
                        completed: "2026-03-26T14:46:00Z",
                        outcome: "REJECTED",
                        validations: { run: 14, passed: 11, failed: 2, informational: 1 },
                        hitl_gates_triggered: 2,
                        vendor_rounds: 1,
                        supplier_master_checked: true,
                        sap_ariba_updated: true,
                        rejection_reason: "Pricing variance +5.24% (threshold ±3%) — unresolved after vendor correction attempt"
                    }
                }
            ]
        }
    ];

    // ── Execution loop ────────────────────────────────────────────────────────
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Show processing state
        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: timeStr,
            title: step.title_p,
            status: 'processing'
        });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        if (step.hitl) {
            // HITL gate — set action-needed, block on poll
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'action-needed',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            const gateLabel = step.hitl_gate === 2
                ? 'Needs Attention — HITL Gate 2: Rejection Email Pending Approval'
                : 'Needs Attention — HITL Gate 1: Correction Email Pending Approval';
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', gateLabel);
            await setHitlPending(PROCESS_ID);
            const action = await pollHitl(PROCESS_ID);

            if (action === 'approve' || action === 'send') {
                const sentTitle = step.hitl_gate === 2
                    ? 'Rejection email approved and sent — proceeding to SAP Ariba rejection'
                    : 'Correction email approved and sent — monitoring inbox for vendor response';
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: sentTitle,
                    status: 'success',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', sentTitle);
                await delay(1500);

                // After Gate 1: simulate vendor response delay
                if (step.hitl_gate === 1) {
                    console.log(`${PROCESS_ID}: Simulating vendor response delay (3s)...`);
                    await delay(3000);
                }
            } else {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'Process halted by reviewer at HITL gate',
                    status: 'warning',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted by reviewer at HITL gate');
                console.log(`${PROCESS_ID}: Process halted by reviewer.`);
                return;
            }

        } else if (isFinal) {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'completed',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'Done', step.title_s);

        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'success',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
