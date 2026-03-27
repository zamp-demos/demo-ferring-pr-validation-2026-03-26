const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_002";
const CASE_NAME = "PR-to-PO with Procurement Approval";

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
            title_s: "SAP Ariba queue: 4 pending PRs found — selected PR-2026-00912 (FIFO)",
            reasoning: [
                "Login to SAP Ariba; Authenticated as pace.agent@ferring.com — session established",
                "Opened PR-2026-00912 detail view — status: Pending Approval",
                "Requester: Rajesh Krishnamurthy; Budget Owner: Dr. Priya Nair",
                "Read Company Code: 2100 (Ferring Pharmaceuticals Pvt Ltd)",
                "Preferred Supplier: Bachem AG",
                "3 line items extracted — USD 45,800.00 total",
                "Line 1: Fmoc-Val-OH — 500g × USD 38.40 = USD 19,200.00, MG-API-002",
                "Line 2: Boc-Pro-OH — 250g × USD 72.00 = USD 18,000.00, MG-API-002",
                "Line 3: Custom Peptide Synthesis — 1 LOT × USD 8,600.00 = USD 8,600.00, MG-API-002",
                "FIFO selection: oldest unprocessed PR is PR-2026-00912 (created 2026-03-18)"
            ],
            artifacts: [
                {
                    id: "v-ariba-queue-fpr002",
                    type: "video",
                    label: "SAP Ariba: Login, Queue View & PR-2026-00912 Detail",
                    videoPath: "/data/sap_ariba_queue_fpr002.webm"
                },
                {
                    id: "pr-header-fpr002",
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
                        preferred_supplier: "Bachem AG",
                        region: "India (APAC)",
                        pr_date: "2026-03-18",
                        preferred_ordering_method: "EMAIL",
                        line_items_count: 3,
                        attachment_count: 1,
                        status: "Pending Approval"
                    }
                },
                {
                    id: "line-items-fpr002",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            {
                                line: "1",
                                description: "Fmoc-Val-OH (Peptide Building Block)",
                                qty: "500g",
                                unit_price: "USD 38.40",
                                total: "USD 19,200.00",
                                material_group: "MG-API-002",
                                gl_account: "41200500",
                                account_type: "K",
                                cost_center: "CC-MFG-IN-092",
                                hsn_sac: "29379900"
                            },
                            {
                                line: "2",
                                description: "Boc-Pro-OH (Amino Acid Derivative)",
                                qty: "250g",
                                unit_price: "USD 72.00",
                                total: "USD 18,000.00",
                                material_group: "MG-API-002",
                                gl_account: "41200500",
                                account_type: "K",
                                cost_center: "CC-MFG-IN-092",
                                hsn_sac: "29379900"
                            },
                            {
                                line: "3",
                                description: "Custom Peptide Synthesis — 1 LOT",
                                qty: "1 LOT",
                                unit_price: "USD 8,600.00",
                                total: "USD 8,600.00",
                                material_group: "MG-API-002",
                                gl_account: "41200500",
                                account_type: "K",
                                cost_center: "CC-MFG-IN-092",
                                hsn_sac: "998599"
                            }
                        ],
                        attachment_metadata: [
                            { filename: "Bachem_Invoice_INV-2026-BH-11472.pdf", size_kb: 287, pages: 2, type: "PDF" }
                        ]
                    }
                }
            ]
        },

        // ── STAGE 2: Validation of PR Data and Supplier Data ──────────────────────────
        {
            id: "step-2",
            title_p: "Running validation — sum check, supplier master lookup, spend threshold...",
            title_s: "All validations PASS — USD 45,800 under $50K threshold — approved vendor list path",
            reasoning: [
                "Sum check: USD 19,200 + USD 18,000 + USD 8,600 = USD 45,800.00 — matches PR header ✓",
                "Supplier Master enrichment: looked up SUP-72103 in master DB",
                "Retrieved registered supplier name: 'Bachem AG' status: Active, ordering method: EMAIL",
                "Retrieved payment terms: Net 30, region: EMEA, registration date: 2019-01-15",
                "Supplier status confirmed: Active — no purchasing blocks, no compliance flags",
                "PR to be validated and approved on SAP Ariba by PACE.",
                "Invoice total under $50,000; Invoke PO to approved vendor list",
                "V2 Accounting: CC-MFG-IN-092, GL 41200500 — consistent ✓ PASS",
                "V3 Budget Owner: Dr. Priya Nair ≠ Rajesh Krishnamurthy (requester) — segregation confirmed ✓ PASS",
                "V4 Currency: USD consistent across PR and all line items ✓ PASS",
                "V5 Material Group: MG-API-002 present in approved master list ✓ PASS",
                "V6 Supplier: Bachem AG — exact match to SUP-72103 ✓ PASS",
                "V7 Pricing: USD 45,800.00 = USD 45,800.00 — no discrepancy ✓ PASS",
                "Overall validation: 7/7 PASS — proceeding to PO dispatch"
            ],
            artifacts: [
                {
                    id: "v-ariba-approval-fpr002",
                    type: "video",
                    label: "SAP Ariba: PR-2026-00912 Validation & Approval",
                    videoPath: "/data/sap_ariba_approval_fpr002.webm"
                },
                {
                    id: "validation-results-fpr002",
                    type: "json",
                    label: "Validation Results & Supplier Master",
                    data: {
                        sum_check: {
                            line_1: "USD 19,200.00",
                            line_2: "USD 18,000.00",
                            line_3: "USD 8,600.00",
                            computed_total: "USD 45,800.00",
                            pr_header_total: "USD 45,800.00",
                            result: "MATCH ✓"
                        },
                        supplier_master: {
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
                        },
                        spend_threshold: {
                            amount_usd: 45800,
                            threshold_direct: 50000,
                            threshold_two_quotes: 75000,
                            threshold_rfp: 75000,
                            determination: "Under $50,000 — direct PO to approved vendor list",
                            path: "APPROVED_VENDOR_LIST"
                        },
                        validations: {
                            V1_SumCheck: "PASS",
                            V2_Accounting: "PASS",
                            V3_BudgetOwner: "PASS",
                            V4_Currency: "PASS",
                            V5_MaterialGroup: "PASS",
                            V6_Supplier: "PASS",
                            V7_Pricing: "PASS",
                            overall: "PASS — 7/7"
                        }
                    }
                }
            ]
        },

        // ── STAGE 3: PO Dispatch — HITL Gate ──────────────────────────────────────────
        {
            id: "step-3",
            hitl: true,
            hitl_gate: 1,
            title_p: "PO draft ready — requesting procurement approval before sending to Bachem AG...",
            title_s: "PO email drafted to orders@bachem.com — awaiting procurement approval",
            reasoning: [
                "All 7 validations passed — proceeding to PO dispatch",
                "PO generated: PO-2026-00912, referencing PR-2026-00912",
                "Supplier: Bachem AG (SUP-72103), ordering email: orders@bachem.com",
                "PO total: USD 45,800.00 — 3 line items as per approved PR",
                "PO attachment generated: Ferring_PO_2026_00912_Bachem.pdf",
                "Procurement policy: PO email requires human approval before send for India/APAC region",
                "HITL gate triggered — awaiting procurement team approval to dispatch"
            ],
            artifacts: [
                {
                    id: "po-pdf-fpr002",
                    type: "file",
                    label: "PO Document — Bachem AG (PO-2026-00912)",
                    pdfPath: "/data/ferring_po_2026_00912_bachem.pdf"
                },
                {
                    id: "po-email-draft-fpr002",
                    type: "email_draft",
                    label: "Email Draft: PO Dispatch to Bachem AG",
                    data: {
                        isIncoming: false,
                        to: "orders@bachem.com",
                        cc: "rajesh.krishnamurthy@ferring.com, procurement-india@ferring.com",
                        subject: "Purchase Order PO-2026-00912 — Ferring Pharmaceuticals Pvt Ltd",
                        body: "Dear Bachem AG Order Management Team,\n\nPlease find attached Purchase Order PO-2026-00912 issued by Ferring Pharmaceuticals Pvt Ltd (Company Code 2100) in connection with your quotation for peptide building blocks and synthesis services.\n\nPurchase Order Details:\n  PO Number:     PO-2026-00912\n  PR Reference:  PR-2026-00912\n  Issue Date:    2026-03-26\n  Supplier:      Bachem AG (SUP-72103)\n  Ship-To:       Ferring API Manufacturing, Plot 47, Bangalore, India\n\nLine Items:\n  1. Fmoc-Val-OH (Peptide Building Block)    500g   × USD  38.40  = USD  19,200.00\n  2. Boc-Pro-OH (Amino Acid Derivative)      250g   × USD  72.00  = USD  18,000.00\n  3. Custom Peptide Synthesis                1 LOT  × USD 8,600.00 = USD   8,600.00\n\n  Total:  USD 45,800.00\n  Payment Terms:  Net 30\n  Currency:       USD\n\nPlease acknowledge receipt of this PO and confirm your expected delivery schedule.\n\nFor queries, contact: procurement-india@ferring.com\n\nBest regards,\nFerring Procurement Automation — Pace Agent\nprocurement-india@ferring.com"
                    }
                }
            ]
        },

        // ── Post-HITL: Convert PR → PO on SAP Ariba ───────────────────────────────────
        {
            id: "step-3b",
            title_p: "PO email approved — sending to Bachem AG and converting PR to PO on SAP Ariba...",
            title_s: "PO dispatched to Bachem AG — PR-2026-00912 converted to PO, status: Ordered",
            reasoning: [
                "Procurement approval received — sending PO email to orders@bachem.com",
                "Email delivered with PO-2026-00912 attachment (Ferring_PO_2026_00912_Bachem.pdf)",
                "Desktop agent logged in to SAP Ariba as pace.agent@ferring.com",
                "Navigated to PR-2026-00912 — selected 'Convert to Purchase Order' action",
                "PO Number assigned: PO-2026-00912",
                "Status changed: Pending Approval → Ordered",
                "System confirmation received (200 OK) — PR-to-PO conversion complete"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-creation-fpr002",
                    type: "video",
                    label: "SAP Ariba: PR-2026-00912 → PO-2026-00912 Conversion",
                    videoPath: "/data/sap_ariba_po_creation_fpr002.webm"
                },
                {
                    id: "ariba-po-creation-confirm-fpr002",
                    type: "json",
                    label: "SAP Ariba PO Creation Confirmation",
                    data: {
                        pr_id: "PR-2026-00912",
                        po_id: "PO-2026-00912",
                        action: "CONVERT_TO_PO",
                        status_before: "Pending Approval",
                        status_after: "Ordered",
                        supplier: "Bachem AG (SUP-72103)",
                        total: "USD 45,800.00",
                        timestamp: "2026-03-26T10:18:00Z",
                        confirmed_by: "Pace Automation Agent + Procurement Approver",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 4: Supplier Confirmation Email ──────────────────────────────────────
        {
            id: "step-4",
            title_p: "Monitoring inbox for Bachem AG PO confirmation and invoice...",
            title_s: "Bachem AG confirmation received — PO acknowledged, invoice attached, PO status: Confirmed",
            reasoning: [
                "Incoming email received from orders@bachem.com",
                "Subject: Order Confirmation — PO-2026-00912 (Ferring Pharmaceuticals Pvt Ltd)",
                "Supplier confirms: PO-2026-00912 accepted, delivery in 14–18 business days",
                "Invoice attached: Bachem_Invoice_INV-2026-BH-11472.pdf (2 pages, 287KB)",
                "Validated invoice: supplier 'Bachem AG' matches SUP-72103 ✓",
                "Validated invoice total: USD 45,800.00 matches PO-2026-00912 ✓",
                "Payment terms Net 30 confirmed — consistent with Supplier Master ✓",
                "Desktop agent updated PO-2026-00912 on SAP Ariba — status: Ordered → Confirmed",
                "Invoice attached to PO record in Ariba (200 OK)"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-confirmed-fpr002",
                    type: "video",
                    label: "SAP Ariba: PO-2026-00912 Updated to Confirmed",
                    videoPath: "/data/sap_ariba_po_confirmed_fpr002.webm"
                },
                {
                    id: "supplier-confirmation-email-fpr002",
                    type: "email_draft",
                    label: "Incoming: Bachem AG Order Confirmation + Invoice",
                    data: {
                        isIncoming: true,
                        from: "orders@bachem.com",
                        to: "procurement-india@ferring.com",
                        cc: "rajesh.krishnamurthy@ferring.com",
                        subject: "Order Confirmation — PO-2026-00912 (Ferring Pharmaceuticals Pvt Ltd)",
                        body: "Dear Ferring Procurement Team,\n\nThank you for Purchase Order PO-2026-00912 dated 26 March 2026.\n\nWe are pleased to confirm acceptance of your order:\n\n  PO Number:   PO-2026-00912\n  Order Value: USD 45,800.00\n  Items:       Fmoc-Val-OH (500g), Boc-Pro-OH (250g), Custom Peptide Synthesis (1 LOT)\n  Delivery:    14–18 business days to Ferring API Manufacturing, Bangalore\n  Payment:     Net 30 from invoice date\n\nPlease find our invoice INV-2026-BH-11472 attached for your records.\n\nFor any queries regarding this order, please reference PO-2026-00912.\n\nBest regards,\nBachem AG — Order Management\norders@bachem.com"
                    }
                },
                {
                    id: "bachem-invoice-fpr002",
                    type: "file",
                    label: "Invoice — Bachem AG (INV-2026-BH-11472)",
                    pdfPath: "/data/bachem_invoice_2026.pdf"
                },
                {
                    id: "po-confirmed-ariba-fpr002",
                    type: "json",
                    label: "SAP Ariba PO Confirmed — Update Record",
                    data: {
                        po_id: "PO-2026-00912",
                        action: "UPDATE_STATUS",
                        status_before: "Ordered",
                        status_after: "Confirmed",
                        invoice_attached: "INV-2026-BH-11472",
                        invoice_validated: true,
                        invoice_amount: "USD 45,800.00",
                        po_amount: "USD 45,800.00",
                        amount_match: "PASS ✓",
                        timestamp: "2026-03-27T08:42:00Z",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 5: Goods and Services Receipt Confirmation ──────────────────────────
        {
            id: "step-5",
            title_p: "Monitoring inbox for Bachem AG delivery and goods receipt confirmation...",
            title_s: "Goods receipt confirmed — PO-2026-00912 updated to Invoiced on SAP Ariba",
            reasoning: [
                "Automated receipt trigger fired — incoming email from orders@bachem.com",
                "Subject: Shipment Dispatched — PO-2026-00912 (Ferring Pharmaceuticals Pvt Ltd)",
                "Verified PO reference: PO-2026-00912 ✓",
                "Shipment details: DHL Express tracking AWB 1234567890, dispatched 2026-04-09",
                "Items confirmed: Fmoc-Val-OH 500g, Boc-Pro-OH 250g, Custom Peptide Synthesis 1 LOT",
                "Delivery address: Ferring API Manufacturing, Plot 47, Bangalore — confirmed ✓",
                "Goods receipt recorded in Ariba against PO-2026-00912",
                "Desktop agent updated PO status: Confirmed → Invoiced on SAP Ariba (200 OK)",
                "PR-to-PO lifecycle complete — all stages fulfilled"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-invoiced-fpr002",
                    type: "video",
                    label: "SAP Ariba: PO-2026-00912 Updated to Invoiced",
                    videoPath: "/data/sap_ariba_po_invoiced_fpr002.webm"
                },
                {
                    id: "receipt-email-fpr002",
                    type: "email_draft",
                    label: "Incoming: Bachem AG Shipment Dispatch & Receipt Notice",
                    data: {
                        isIncoming: true,
                        from: "orders@bachem.com",
                        to: "procurement-india@ferring.com",
                        cc: "rajesh.krishnamurthy@ferring.com",
                        subject: "Shipment Dispatched — PO-2026-00912 (Ferring Pharmaceuticals Pvt Ltd)",
                        body: "Dear Ferring Procurement Team,\n\nWe are pleased to advise that your order PO-2026-00912 has been dispatched.\n\nShipment Details:\n  Tracking:     DHL Express AWB 1234567890\n  Dispatched:   09 April 2026\n  Contents:     Fmoc-Val-OH 500g, Boc-Pro-OH 250g, Custom Peptide Synthesis 1 LOT\n  Destination:  Ferring API Manufacturing, Plot 47, Bangalore, India\n  Est. Arrival: 11–14 April 2026\n\nCertificates of Analysis and batch documentation are enclosed with the shipment.\n\nInvoice INV-2026-BH-11472 remains valid. Payment terms: Net 30 from invoice date (26 March 2026).\n\nBest regards,\nBachem AG — Order Management\norders@bachem.com"
                    }
                },
                {
                    id: "po-invoiced-ariba-fpr002",
                    type: "json",
                    label: "SAP Ariba PO Invoiced — Final Update",
                    data: {
                        po_id: "PO-2026-00912",
                        pr_id: "PR-2026-00912",
                        action: "UPDATE_STATUS",
                        status_before: "Confirmed",
                        status_after: "Invoiced",
                        goods_receipt_recorded: true,
                        shipment_tracking: "DHL Express AWB 1234567890",
                        dispatch_date: "2026-04-09",
                        supplier: "Bachem AG (SUP-72103)",
                        total: "USD 45,800.00",
                        timestamp: "2026-04-09T12:05:00Z",
                        api_response: "200 OK",
                        lifecycle_complete: true
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
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', 'Needs Attention — HITL Gate: PO Email Awaiting Procurement Approval');
            await setHitlPending(PROCESS_ID);
            const action = await pollHitl(PROCESS_ID);

            if (action === 'approve' || action === 'send') {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'PO email approved by procurement — dispatching to Bachem AG',
                    status: 'success',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', 'PO approved — converting PR to PO on SAP Ariba');
                await delay(1500);
            } else {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'PO dispatch halted by procurement team',
                    status: 'warning',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted by procurement at PO dispatch gate');
                console.log(`${PROCESS_ID}: Process halted by procurement team.`);
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
