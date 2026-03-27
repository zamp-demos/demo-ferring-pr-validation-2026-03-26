const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_003";
const CASE_NAME = "High-Value RFP Required";

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

        // ── STAGE 1: SAP Ariba Queue and Data Extraction ──────────────────────────────
        {
            id: "step-1",
            title_p: "Logging in to SAP Ariba — checking pending approvals queue...",
            title_s: "SAP Ariba queue: 3 pending PRs found — selected PR-2026-01045 (FIFO)",
            reasoning: [
                "Login to SAP Ariba; Authenticated as pace.agent@ferring.com — session established",
                "Opened PR-2026-01045 detail view — status: Pending Approval",
                "Requester: Dr. Martin Schreiber; Budget Owner: Prof. Astrid Lindqvist",
                "Read Company Code: 3200 (Ferring International Center SA)",
                "Preferred Supplier: Catalent Pharma Solutions",
                "3 line items extracted — EUR 185,000.00 total",
                "Line 1: Clinical Trial Supply & Packaging — 1 LOT × EUR 85,000.00 = EUR 85,000.00, MG-CLIN-003",
                "Line 2: Labelling & Artwork Services — 1 LOT × EUR 65,000.00 = EUR 65,000.00, MG-CLIN-003",
                "Line 3: Distribution Coordination & Cold Chain — 1 LOT × EUR 35,000.00 = EUR 35,000.00, MG-CLIN-003",
                "FIFO selection: oldest unprocessed PR is PR-2026-01045 (created 2026-03-20)",
                "Attachment found: Catalent_SOW_ClinicalPackaging_2026.pdf (8 pages, 445KB)"
            ],
            artifacts: [
                {
                    id: "v-ariba-queue-fpr003",
                    type: "video",
                    label: "SAP Ariba: Login, Queue View & PR-2026-01045 Detail",
                    videoPath: "/data/sap_ariba_queue_fpr003.webm"
                },
                {
                    id: "pr-header-fpr003",
                    type: "json",
                    label: "PR Header Data",
                    data: {
                        pr_id: "PR-2026-01045",
                        company_code: "3200",
                        entity: "Ferring International Center SA",
                        requester: "Dr. Martin Schreiber",
                        budget_owner: "Prof. Astrid Lindqvist",
                        po_owner: "Dr. Martin Schreiber",
                        cost_center: "CC-CLIN-IC-027",
                        currency: "EUR",
                        total_amount: "185,000.00",
                        preferred_supplier: "Catalent Pharma Solutions",
                        region: "India/ROW",
                        pr_date: "2026-03-20",
                        preferred_ordering_method: "EMAIL",
                        line_items_count: 3,
                        attachment_count: 1,
                        status: "Pending Approval"
                    }
                },
                {
                    id: "line-items-fpr003",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            {
                                line: "1",
                                description: "Clinical Trial Supply & Packaging",
                                qty: "1 LOT",
                                unit_price: "EUR 85,000.00",
                                total: "EUR 85,000.00",
                                material_group: "MG-CLIN-003",
                                gl_account: "64100200",
                                account_type: "K",
                                cost_center: "CC-CLIN-IC-027",
                                hsn_sac: "998599"
                            },
                            {
                                line: "2",
                                description: "Labelling & Artwork Services",
                                qty: "1 LOT",
                                unit_price: "EUR 65,000.00",
                                total: "EUR 65,000.00",
                                material_group: "MG-CLIN-003",
                                gl_account: "64100200",
                                account_type: "K",
                                cost_center: "CC-CLIN-IC-027",
                                hsn_sac: "998599"
                            },
                            {
                                line: "3",
                                description: "Distribution Coordination & Cold Chain",
                                qty: "1 LOT",
                                unit_price: "EUR 35,000.00",
                                total: "EUR 35,000.00",
                                material_group: "MG-CLIN-003",
                                gl_account: "64100200",
                                account_type: "K",
                                cost_center: "CC-CLIN-IC-027",
                                hsn_sac: "998599"
                            }
                        ],
                        attachment_metadata: [
                            { filename: "Catalent_SOW_ClinicalPackaging_2026.pdf", size_kb: 445, pages: 8, type: "PDF" }
                        ]
                    }
                },
                {
                    id: "sow-pdf-fpr003",
                    type: "file",
                    label: "SOW — Catalent Pharma Solutions (Clinical Packaging 2026)",
                    pdfPath: "/data/catalent_sow_packaging_2026.pdf"
                }
            ]
        },

        // ── STAGE 2: Validation of PR Data and Supplier Data ──────────────────────────
        {
            id: "step-2",
            title_p: "Running validation — sum check, supplier master lookup, spend threshold assessment...",
            title_s: "Spend threshold FLAG: EUR 185,000 exceeds $75K — formal RFP process required before PO",
            reasoning: [
                "Sum check: EUR 85,000 + EUR 65,000 + EUR 35,000 = EUR 185,000.00 — matches PR header ✓",
                "Supplier Master enrichment: looked up SUP-61108 in master DB",
                "Retrieved registered supplier name: 'Catalent Pharma Solutions Inc.' status: Active, ordering method: EMAIL",
                "Retrieved payment terms: Net 45, region: Global, registration date: 2017-06-30",
                "Supplier status confirmed: Active — no purchasing blocks, no compliance flags",
                "Name match: 'Catalent Pharma Solutions' (PR) vs 'Catalent Pharma Solutions Inc.' (Master) — 95% match, above 90% threshold ✓",
                "V2 Accounting: CC-CLIN-IC-027, GL 64100200 — consistent ✓ PASS",
                "V3 Budget Owner: Prof. Astrid Lindqvist ≠ Dr. Martin Schreiber (requester) — segregation confirmed ✓ PASS",
                "V4 Currency: EUR consistent across PR, line items, and SOW ✓ PASS",
                "V5 Material Group: MG-CLIN-003 present in approved master list ✓ PASS",
                "V6 Supplier: Catalent Pharma Solutions — 95% match to SUP-61108 ✓ PASS",
                "V7 Pricing: EUR 185,000.00 = EUR 185,000.00 — exact match ✓ PASS",
                "SPEND THRESHOLD: EUR 185,000 (~USD 200,300) exceeds $75,000 threshold — FORMAL RFP REQUIRED before PO can be issued",
                "Process cannot proceed to PO dispatch — RFP completion must be confirmed by procurement"
            ],
            artifacts: [
                {
                    id: "v-ariba-approval-fpr003",
                    type: "video",
                    label: "SAP Ariba: PR-2026-01045 Validation View",
                    videoPath: "/data/sap_ariba_approval_fpr003.webm"
                },
                {
                    id: "validation-results-fpr003",
                    type: "json",
                    label: "Validation Results & Spend Threshold Assessment",
                    data: {
                        sum_check: {
                            line_1: "EUR 85,000.00",
                            line_2: "EUR 65,000.00",
                            line_3: "EUR 35,000.00",
                            computed_total: "EUR 185,000.00",
                            pr_header_total: "EUR 185,000.00",
                            result: "MATCH ✓"
                        },
                        supplier_master: {
                            supplier_id: "SUP-61108",
                            registered_name: "Catalent Pharma Solutions Inc.",
                            pr_name: "Catalent Pharma Solutions",
                            name_match_score: "95%",
                            name_match_threshold: "90%",
                            name_match_result: "PASS ✓",
                            status: "Active",
                            ordering_method: "EMAIL",
                            ordering_email: "catalent-orders@catalent.com",
                            payment_terms: "Net 45",
                            region: "Global",
                            registration_date: "2017-06-30",
                            purchasing_blocks: "None",
                            compliance_flags: "None"
                        },
                        spend_threshold: {
                            amount_eur: 185000,
                            amount_usd_approx: 200300,
                            threshold_direct_usd: 50000,
                            threshold_two_quotes_usd: 75000,
                            threshold_rfp_usd: 75000,
                            determination: "Exceeds $75,000 — FORMAL RFP PROCESS REQUIRED",
                            path: "RFP_REQUIRED",
                            flag: "BLOCKED — cannot issue PO until RFP is complete and procurement confirms"
                        },
                        validations: {
                            V1_SumCheck: "PASS",
                            V2_Accounting: "PASS",
                            V3_BudgetOwner: "PASS",
                            V4_Currency: "PASS",
                            V5_MaterialGroup: "PASS",
                            V6_Supplier: "PASS (95% name match)",
                            V7_Pricing: "PASS",
                            overall: "PASS — 7/7 validations, BUT RFP required before PO"
                        }
                    }
                }
            ]
        },

        // ── STAGE 3: RFP Confirmation Gate — HITL ─────────────────────────────────────
        {
            id: "step-3",
            hitl: true,
            hitl_gate: 1,
            title_p: "RFP required — notifying procurement and awaiting RFP completion confirmation...",
            title_s: "RFP notification sent — awaiting procurement confirmation that RFP is complete",
            reasoning: [
                "PR value EUR 185,000 exceeds formal RFP threshold of $75,000",
                "Ferring procurement policy: all spend above $75K requires a formal RFP before PO issuance",
                "RFP notification drafted to procurement-global@ferring.com",
                "Notification includes: PR reference, supplier, value, line item descriptions, SOW attachment reference",
                "Process is paused — PO cannot be issued until procurement confirms RFP is complete",
                "HITL gate triggered — procurement team must confirm RFP completion to proceed"
            ],
            artifacts: [
                {
                    id: "rfp-notification-email-fpr003",
                    type: "email_draft",
                    label: "Email Draft: RFP Initiation Notification to Procurement",
                    data: {
                        isIncoming: false,
                        to: "procurement-global@ferring.com",
                        cc: "dr.martin.schreiber@ferring.com, astrid.lindqvist@ferring.com",
                        subject: "RFP Required — PR-2026-01045 (Catalent Pharma Solutions, EUR 185,000)",
                        body: "Dear Procurement Team,\n\nPurchase Requisition PR-2026-01045 has been reviewed and validated by the Pace automation agent. All data validations have passed; however, the requisition value of EUR 185,000.00 exceeds Ferring's formal RFP threshold of USD 75,000.\n\nPR Details:\n  PR Number:     PR-2026-01045\n  Company Code:  3200 (Ferring International Center SA)\n  Requester:     Dr. Martin Schreiber\n  Budget Owner:  Prof. Astrid Lindqvist\n  Supplier:      Catalent Pharma Solutions (SUP-61108)\n  Total Value:   EUR 185,000.00\n\nScope of Work:\n  Line 1: Clinical Trial Supply & Packaging       EUR  85,000.00\n  Line 2: Labelling & Artwork Services            EUR  65,000.00\n  Line 3: Distribution Coordination & Cold Chain  EUR  35,000.00\n\nAction Required:\nA formal RFP must be conducted and completed before a Purchase Order can be issued to Catalent Pharma Solutions. Please initiate the RFP process through the Ferring procurement portal and confirm completion to allow PO dispatch.\n\nSOW attachment: Catalent_SOW_ClinicalPackaging_2026.pdf is available in PR-2026-01045 on SAP Ariba.\n\nThis PR will remain on hold pending your confirmation.\n\nBest regards,\nFerring Procurement Automation — Pace Agent\nprocurement-global@ferring.com"
                    }
                },
                {
                    id: "rfp-hold-status-fpr003",
                    type: "json",
                    label: "PR Hold Status — RFP Required",
                    data: {
                        pr_id: "PR-2026-01045",
                        hold_reason: "RFP_REQUIRED",
                        amount_eur: "185,000.00",
                        threshold_usd: "75,000",
                        supplier: "Catalent Pharma Solutions (SUP-61108)",
                        rfp_initiated_by: "Pace Automation Agent",
                        rfp_notification_sent_to: "procurement-global@ferring.com",
                        pr_status_on_ariba: "Pending Approval (on hold)",
                        awaiting: "Procurement confirmation that RFP is complete",
                        hold_timestamp: "2026-03-26T11:30:00Z"
                    }
                }
            ]
        },

        // ── Post-HITL: RFP Confirmed — Convert PR → PO on SAP Ariba ──────────────────
        {
            id: "step-3b",
            title_p: "RFP completion confirmed — dispatching PO to Catalent Pharma Solutions...",
            title_s: "RFP confirmed — PO dispatched to Catalent, PR-2026-01045 converted to PO status: Ordered",
            reasoning: [
                "Procurement confirmed: RFP completed, Catalent Pharma Solutions selected as awarded vendor",
                "RFP reference: RFP-2026-IC-047 — Catalent awarded on best-value basis",
                "PO generated: PO-2026-01045, referencing PR-2026-01045 and RFP-2026-IC-047",
                "PO email dispatched to catalent-orders@catalent.com with PO attachment",
                "Desktop agent logged in to SAP Ariba as pace.agent@ferring.com",
                "Navigated to PR-2026-01045 — selected 'Convert to Purchase Order' action",
                "PO Number assigned: PO-2026-01045",
                "Status changed: Pending Approval → Ordered (200 OK)"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-creation-fpr003",
                    type: "video",
                    label: "SAP Ariba: PR-2026-01045 → PO-2026-01045 Conversion",
                    videoPath: "/data/sap_ariba_po_creation_fpr003.webm"
                },
                {
                    id: "po-dispatch-email-fpr003",
                    type: "email_draft",
                    label: "Email Draft: PO Dispatch to Catalent Pharma Solutions",
                    data: {
                        isIncoming: false,
                        to: "catalent-orders@catalent.com",
                        cc: "dr.martin.schreiber@ferring.com, procurement-global@ferring.com",
                        subject: "Purchase Order PO-2026-01045 — Ferring International Center SA",
                        body: "Dear Catalent Pharma Solutions Order Management Team,\n\nPlease find attached Purchase Order PO-2026-01045 issued by Ferring International Center SA (Company Code 3200) following completion of RFP-2026-IC-047.\n\nPurchase Order Details:\n  PO Number:     PO-2026-01045\n  PR Reference:  PR-2026-01045\n  RFP Reference: RFP-2026-IC-047\n  Issue Date:    2026-03-27\n  Supplier:      Catalent Pharma Solutions Inc. (SUP-61108)\n\nLine Items:\n  1. Clinical Trial Supply & Packaging          1 LOT  EUR  85,000.00\n  2. Labelling & Artwork Services               1 LOT  EUR  65,000.00\n  3. Distribution Coordination & Cold Chain     1 LOT  EUR  35,000.00\n\n  Total:  EUR 185,000.00\n  Payment Terms:  Net 45\n  Currency:       EUR\n\nPlease acknowledge receipt and confirm your project commencement schedule.\n\nFor queries, contact: procurement-global@ferring.com\n\nBest regards,\nFerring Procurement Automation — Pace Agent\nprocurement-global@ferring.com"
                    }
                },
                {
                    id: "ariba-po-creation-confirm-fpr003",
                    type: "json",
                    label: "SAP Ariba PO Creation Confirmation",
                    data: {
                        pr_id: "PR-2026-01045",
                        po_id: "PO-2026-01045",
                        rfp_reference: "RFP-2026-IC-047",
                        action: "CONVERT_TO_PO",
                        status_before: "Pending Approval",
                        status_after: "Ordered",
                        supplier: "Catalent Pharma Solutions Inc. (SUP-61108)",
                        total: "EUR 185,000.00",
                        timestamp: "2026-03-27T09:15:00Z",
                        confirmed_by: "Pace Automation Agent + Procurement (RFP confirmed)",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 4: Supplier Confirmation Email ──────────────────────────────────────
        {
            id: "step-4",
            title_p: "Monitoring inbox for Catalent Pharma Solutions PO confirmation and invoice...",
            title_s: "Catalent confirmation received — PO acknowledged, invoice attached, PO status: Confirmed",
            reasoning: [
                "Incoming email received from catalent-orders@catalent.com",
                "Subject: Order Confirmation — PO-2026-01045 (Ferring International Center SA)",
                "Supplier confirms PO-2026-01045 accepted, project kickoff scheduled for 2026-04-07",
                "Invoice attached: Catalent_Invoice_INV-CAT-2026-3847.pdf (3 pages, 312KB)",
                "Validated invoice: supplier 'Catalent Pharma Solutions Inc.' matches SUP-61108 ✓",
                "Validated invoice total: EUR 185,000.00 matches PO-2026-01045 ✓",
                "Payment terms Net 45 confirmed — consistent with Supplier Master ✓",
                "Desktop agent updated PO-2026-01045 on SAP Ariba — status: Ordered → Confirmed",
                "Invoice attached to PO record in Ariba (200 OK)"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-confirmed-fpr003",
                    type: "video",
                    label: "SAP Ariba: PO-2026-01045 Updated to Confirmed",
                    videoPath: "/data/sap_ariba_po_confirmed_fpr003.webm"
                },
                {
                    id: "supplier-confirmation-email-fpr003",
                    type: "email_draft",
                    label: "Incoming: Catalent Pharma Solutions Order Confirmation + Invoice",
                    data: {
                        isIncoming: true,
                        from: "catalent-orders@catalent.com",
                        to: "procurement-global@ferring.com",
                        cc: "dr.martin.schreiber@ferring.com",
                        subject: "Order Confirmation — PO-2026-01045 (Ferring International Center SA)",
                        body: "Dear Ferring Procurement Team,\n\nThank you for Purchase Order PO-2026-01045 dated 27 March 2026, reference RFP-2026-IC-047.\n\nWe are pleased to confirm acceptance of your order:\n\n  PO Number:   PO-2026-01045\n  Order Value: EUR 185,000.00\n  Scope:       Clinical Trial Supply & Packaging, Labelling & Artwork, Distribution & Cold Chain\n  Kickoff:     07 April 2026\n  Completion:  Estimated 31 March 2027 (12-month programme)\n  Payment:     Net 45 from invoice date\n\nPlease find our invoice INV-CAT-2026-3847 attached for your records.\n\nWe look forward to supporting Ferring's clinical trial programme.\n\nBest regards,\nCatalent Pharma Solutions — Order Management\ncatalent-orders@catalent.com"
                    }
                },
                {
                    id: "catalent-invoice-fpr003",
                    type: "file",
                    label: "Invoice — Catalent Pharma Solutions (INV-CAT-2026-3847)",
                    pdfPath: "/data/catalent_invoice_2026.pdf"
                },
                {
                    id: "po-confirmed-ariba-fpr003",
                    type: "json",
                    label: "SAP Ariba PO Confirmed — Update Record",
                    data: {
                        po_id: "PO-2026-01045",
                        action: "UPDATE_STATUS",
                        status_before: "Ordered",
                        status_after: "Confirmed",
                        invoice_attached: "INV-CAT-2026-3847",
                        invoice_validated: true,
                        invoice_amount: "EUR 185,000.00",
                        po_amount: "EUR 185,000.00",
                        amount_match: "PASS ✓",
                        timestamp: "2026-03-28T10:20:00Z",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 5: Goods and Services Receipt Confirmation ──────────────────────────
        {
            id: "step-5",
            title_p: "Monitoring for Catalent Pharma Solutions services delivery and receipt confirmation...",
            title_s: "Services receipt confirmed — PO-2026-01045 updated to Invoiced on SAP Ariba",
            reasoning: [
                "Automated receipt trigger fired — incoming email from catalent-orders@catalent.com",
                "Subject: Services Delivery Confirmation — PO-2026-01045 (Ferring International Center SA)",
                "Verified PO reference: PO-2026-01045, RFP reference: RFP-2026-IC-047 ✓",
                "Services confirmed: Clinical Trial Supply & Packaging complete, Labelling & Artwork complete, Distribution coordination initiated",
                "Delivery milestone: Phase 1 (packaging & labelling) delivered to Ferring clinical depot ✓",
                "Goods receipt note recorded in Ariba against PO-2026-01045",
                "Desktop agent updated PO status: Confirmed → Invoiced on SAP Ariba (200 OK)",
                "Full PR-to-PO lifecycle complete — RFP path successfully executed"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-invoiced-fpr003",
                    type: "video",
                    label: "SAP Ariba: PO-2026-01045 Updated to Invoiced",
                    videoPath: "/data/sap_ariba_po_invoiced_fpr003.webm"
                },
                {
                    id: "receipt-email-fpr003",
                    type: "email_draft",
                    label: "Incoming: Catalent Services Delivery Confirmation",
                    data: {
                        isIncoming: true,
                        from: "catalent-orders@catalent.com",
                        to: "procurement-global@ferring.com",
                        cc: "dr.martin.schreiber@ferring.com",
                        subject: "Services Delivery Confirmation — PO-2026-01045 (Ferring International Center SA)",
                        body: "Dear Ferring Procurement Team,\n\nWe are pleased to confirm delivery of services under Purchase Order PO-2026-01045.\n\nDelivery Summary:\n  PO Number:     PO-2026-01045\n  RFP Reference: RFP-2026-IC-047\n  Phase 1 Complete (as at 12 April 2026):\n    - Clinical Trial Supply & Packaging delivered to Ferring clinical depot\n    - Labelling & Artwork Services completed and approved\n  Phase 2 (Distribution Coordination & Cold Chain) — in progress per schedule\n\nInvoice INV-CAT-2026-3847 (EUR 185,000.00) remains valid.\nPayment due: Net 45 from 27 March 2026 = 11 May 2026.\n\nThank you for the opportunity to support Ferring's clinical programme.\n\nBest regards,\nCatalent Pharma Solutions — Order Management\ncatalent-orders@catalent.com"
                    }
                },
                {
                    id: "po-invoiced-ariba-fpr003",
                    type: "json",
                    label: "SAP Ariba PO Invoiced — Final Update",
                    data: {
                        po_id: "PO-2026-01045",
                        pr_id: "PR-2026-01045",
                        rfp_reference: "RFP-2026-IC-047",
                        action: "UPDATE_STATUS",
                        status_before: "Confirmed",
                        status_after: "Invoiced",
                        services_receipt_recorded: true,
                        phase_1_delivered: true,
                        phase_2_in_progress: true,
                        supplier: "Catalent Pharma Solutions Inc. (SUP-61108)",
                        total: "EUR 185,000.00",
                        payment_due: "2026-05-11",
                        timestamp: "2026-04-12T14:30:00Z",
                        api_response: "200 OK",
                        lifecycle_complete: true,
                        path_taken: "RFP_REQUIRED — formal RFP completed, vendor awarded, PO issued"
                    }
                }
            ]
        }

    ];

    // ── Execution loop ──────────────────────────────────────────────────────────────────
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
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', 'Needs Attention — HITL Gate: RFP Required — Awaiting Procurement Confirmation');
            await setHitlPending(PROCESS_ID);
            const action = await pollHitl(PROCESS_ID);

            if (action === 'approve' || action === 'send') {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'RFP completion confirmed by procurement — proceeding to PO dispatch',
                    status: 'success',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', 'RFP confirmed — converting PR to PO on SAP Ariba');
                await delay(1500);
            } else {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'Process halted — RFP not confirmed by procurement',
                    status: 'warning',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted — RFP not confirmed at procurement gate');
                console.log(`${PROCESS_ID}: Process halted — RFP not confirmed.`);
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
