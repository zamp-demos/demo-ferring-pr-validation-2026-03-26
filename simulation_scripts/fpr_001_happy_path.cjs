const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_001";
const CASE_NAME = "Standard PR-to-PO Lifecycle";

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

        // ── STAGE 1: SAP Ariba Queue + Data Extraction ──────────────────────────────
        {
            id: "step-1",
            title_p: "Accessing SAP Ariba pending approvals queue...",
            title_s: "SAP Ariba queue: 6 pending PRs found — selected PR-2026-00847 (FIFO)",
            reasoning: [
                "Agent accessed SAP Ariba production instance as pace.agent@ferring.com",
                "Queried pending approvals queue for Zamp.ai_test approval group",
                "Found 6 pending PRs in queue (FIFO ordering applied)",
                "PR-2026-00847 selected — oldest unprocessed PR, Sigma-Aldrich Chemie GmbH, CHF 12,450.00",
                "Other PRs in queue: PR-2026-00851, PR-2026-00854, PR-2026-00861, PR-2026-00863, PR-2026-00869 (deferred)",
                "Double-clicked PR-2026-00847 to open detail view — PR status: Pending Approval",
                "Queue position recorded — processing PR-2026-00847 now"
            ],
            artifacts: [
                {
                    id: "v-ariba-queue-1",
                    type: "video",
                    label: "SAP Ariba: Login, Queue View, PR-2026-00847 Detail",
                    videoPath: "/data/sap_ariba_queue_fpr001.webm"
                }
            ]
        },

        {
            id: "step-2",
            title_p: "Extracting PR header, line items, and attachments from SAP Ariba...",
            title_s: "PR-2026-00847 extracted — 3 line items, CHF 12,450.00, 1 attachment (Quotation, confidence: 0.95)",
            reasoning: [
                "Authenticated as pace.agent@ferring.com — session token valid (SESS-2026-03-26-0101)",
                "PR Header extracted: PR ID PR-2026-00847, Company Code 1000 (Ferring International Center SA)",
                "Requester: Elena Kowalski | Budget Owner: Dr. Thomas Brenner | PO Owner: Elena Kowalski",
                "Cost Center: CC-RD-4521 | Currency: CHF | Total Amount: CHF 12,450.00",
                "Preferred Ordering Method: EMAIL | Comments: 'Urgent — lab replenishment for Q2 synthesis campaign'",
                "Supplier: Sigma-Aldrich Chemie GmbH (SUP-88421) | Region: Switzerland (EMEA)",
                "Line Items tab opened — 3 line items found:",
                "Line 1: Acetonitrile HPLC Grade — 10 L × CHF 285.00 = CHF 2,850.00 | MG-LAB-001 | GL 51200100 | HSN 29031900",
                "Line 2: Methanol HPLC Grade — 10 L × CHF 210.00 = CHF 2,100.00 | MG-LAB-001 | GL 51200100 | HSN 29051100",
                "Line 3: Trifluoroacetic Acid (TFA) — 5 × 500 mL × CHF 1,500.00 = CHF 7,500.00 | MG-API-002 | GL 51200200 | HSN 29159000",
                "Sum check: CHF 2,850 + CHF 2,100 + CHF 7,500 = CHF 12,450.00 — matches PR header ✓",
                "Attachments tab: 1 file found — Sigma_Aldrich_Q2026_0847.pdf (2 pages, 312 KB)",
                "Document classification: Quotation — confidence: 0.95 (high) | V1 Attachment: PASS ✓",
                "Ship-To: SHIP-CH-001 | Sold-To: 1000 | Account Type: K | WBS: WBS-RD-2026-014"
            ],
            artifacts: [
                {
                    id: "pr-header-1",
                    type: "json",
                    label: "PR Header Data",
                    data: {
                        pr_id: "PR-2026-00847",
                        company_code: "1000",
                        entity: "Ferring International Center SA",
                        requester: "Elena Kowalski",
                        budget_owner: "Dr. Thomas Brenner",
                        po_owner: "Elena Kowalski",
                        cost_center: "CC-RD-4521",
                        currency: "CHF",
                        total_amount: "12,450.00",
                        supplier: "Sigma-Aldrich Chemie GmbH",
                        supplier_id: "SUP-88421",
                        preferred_ordering_method: "EMAIL",
                        comments: "Urgent — lab replenishment for Q2 synthesis campaign",
                        region: "Switzerland (EMEA)",
                        ship_to: "SHIP-CH-001",
                        sold_to: "1000",
                        account_type: "K",
                        wbs: "WBS-RD-2026-014",
                        pr_date: "2026-03-20",
                        status: "Pending Approval"
                    }
                },
                {
                    id: "line-items-1",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            {
                                line: "1", description: "Acetonitrile HPLC Grade",
                                qty: "10 L", unit_price: "CHF 285.00", total: "CHF 2,850.00",
                                material_group: "MG-LAB-001", gl_account: "51200100",
                                account_type: "K", cost_center: "CC-RD-4521",
                                hsn_sac: "29031900", deliver_to: "Ferring R&D Lab, Building C, Saint-Prex"
                            },
                            {
                                line: "2", description: "Methanol HPLC Grade",
                                qty: "10 L", unit_price: "CHF 210.00", total: "CHF 2,100.00",
                                material_group: "MG-LAB-001", gl_account: "51200100",
                                account_type: "K", cost_center: "CC-RD-4521",
                                hsn_sac: "29051100", deliver_to: "Ferring R&D Lab, Building C, Saint-Prex"
                            },
                            {
                                line: "3", description: "Trifluoroacetic Acid (TFA) 500 mL ×5",
                                qty: "5 units", unit_price: "CHF 1,500.00", total: "CHF 7,500.00",
                                material_group: "MG-API-002", gl_account: "51200200",
                                account_type: "K", cost_center: "CC-RD-4521",
                                hsn_sac: "29159000", deliver_to: "Ferring R&D Lab, Building C, Saint-Prex"
                            }
                        ],
                        sum_check: "CHF 12,450.00 = PR header total ✓",
                        attachment_check: { files_found: 1, filename: "Sigma_Aldrich_Q2026_0847.pdf", type: "Quotation", confidence: 0.95, v1_result: "PASS" }
                    }
                }
            ]
        },

        // ── STAGE 2: Validation + Supplier Data ──────────────────────────────────────
        {
            id: "step-3",
            title_p: "Running supplier master lookup and full validation suite...",
            title_s: "All 14 validations PASS — Sigma-Aldrich confirmed on approved vendor list, CHF 12,450 under CHF 50K threshold",
            reasoning: [
                "Supplier Master lookup: queried SUP-88421 in Desktop Agent Supplier Master database",
                "Exact match found: Sigma-Aldrich Chemie GmbH | Address: Industriestrasse 25, 9471 Buchs, Switzerland",
                "Ordering method: EMAIL — sigma-aldrich@sial.com | Payment terms: Net 30 | Payment currency: CHF",
                "Supplier status: Active — no purchasing blocks, no compliance flags, no sanctions matches",
                "1 potential match in Supplier Master — no disambiguation needed (unique SUP-88421)",
                "V1 Attachment: PASS — Quotation present (confidence 0.95) ✓",
                "V2 Accounting: Assignment K, Cost Center CC-RD-4521, GL 51200100/51200200 — consistent ✓",
                "V3 Budget Owner: Dr. Thomas Brenner ≠ Elena Kowalski (requester) — segregation confirmed ✓",
                "V4 Currency: CHF consistent across PR, line items, and quotation ✓",
                "V5 Material Group: MG-LAB-001 and MG-API-002 — both in approved master list ✓",
                "V6 Supplier ID: Sigma-Aldrich Chemie GmbH — exact name match, SUP-88421 Active (confidence: 0.99) ✓",
                "V7 Pricing: Quotation CHF 12,450.00 = PR total CHF 12,450.00 — 0.00% variance ✓",
                "V8 Service Type: HSN 29031900/29051100/29159000 — valid lab chemical codes ✓",
                "V9 Ordering Method: EMAIL confirmed — sigma-aldrich@sial.com domain @sial.com matches Supplier Master ✓",
                "V10 Ship-To: SHIP-CH-001 — valid for entity 1000 (Ferring International Center SA) ✓",
                "V11 Sold-To: 1000 = 1000 — exact match ✓",
                "V12 Company Code: Ferring International Center SA — confidence 0.97 ✓",
                "V13 Quantity: all 3 line item quantities verified at Level 2 ✓",
                "V14 Deliver-To: Ferring R&D Lab, Building C, Saint-Prex — valid for CC-RD-4521 ✓",
                "Spend threshold: CHF 12,450 < CHF 50,000 — approved vendor list path, direct send ✓",
                "Overall: 14/14 PASS | Aggregate confidence: 0.97 | Auto-approve eligible — proceeding to PO dispatch"
            ],
            artifacts: [
                {
                    id: "v-ariba-approval-1",
                    type: "video",
                    label: "SAP Ariba: PR Approval Action",
                    videoPath: "/data/sap_ariba_approval_fpr001.webm"
                },
                {
                    id: "val-summary-1",
                    type: "json",
                    label: "Validation Results — All 14 Checks",
                    data: {
                        overall_status: "PASS",
                        total_validations: 14,
                        passed: 14,
                        failed: 0,
                        aggregate_confidence: 0.97,
                        spend_threshold_check: {
                            amount: "CHF 12,450.00",
                            threshold_50k: "CHF 50,000.00",
                            result: "UNDER — approved vendor list, direct send",
                            quotes_required: 0
                        },
                        supplier_master: {
                            supplier_id: "SUP-88421",
                            registered_name: "Sigma-Aldrich Chemie GmbH",
                            address: "Industriestrasse 25, 9471 Buchs, Switzerland",
                            ordering_email: "sigma-aldrich@sial.com",
                            payment_terms: "Net 30",
                            payment_currency: "CHF",
                            ordering_method: "EMAIL",
                            status: "Active",
                            purchasing_blocks: "None",
                            compliance_flags: "None"
                        },
                        validation_results: {
                            V1_Attachment: "PASS", V2_Accounting: "PASS", V3_Budget_Owner: "PASS",
                            V4_Currency: "PASS", V5_Material_Group: "PASS", V6_Supplier_ID: "PASS",
                            V7_Pricing: "PASS", V8_Service_Type: "PASS", V9_Ordering_Method: "PASS",
                            V10_Ship_To: "PASS", V11_Sold_To: "PASS", V12_Company_Code: "PASS",
                            V13_Quantity: "PASS", V14_Deliver_To: "PASS"
                        }
                    }
                }
            ]
        },

        // ── STAGE 3: PO Dispatch to Vendor ───────────────────────────────────────────
        {
            id: "step-4",
            title_p: "Converting PR to PO in SAP Ariba and dispatching to Sigma-Aldrich...",
            title_s: "PO-2026-00847 created and dispatched — PR converted to Ordered status, email sent to sigma-aldrich@sial.com",
            reasoning: [
                "All 14 validations passed — auto-approve path confirmed, no HITL gate required",
                "Desktop agent re-authenticated to SAP Ariba (session refreshed)",
                "Opened PR-2026-00847 — selected 'Convert to PO' from approver actions menu",
                "PO-2026-00847 generated — mapping: PR header → PO header, all 3 line items carried over",
                "PO header: Vendor Sigma-Aldrich Chemie GmbH (SUP-88421) | CHF 12,450.00 | Net 30",
                "PO confirmed in Ariba — status changed: Pending Approval → Ordered",
                "Approval comment recorded: 'All 14 validations PASS. Auto-approved by Pace. CHF 12,450 under CHF 50K threshold — approved vendor list.'",
                "Drafted outgoing PO email to sigma-aldrich@sial.com with PO-2026-00847.pdf attached",
                "CC: elena.kowalski@ferring.com (requester), procurement-ch@ferring.com",
                "Email dispatched automatically — no HITL required (under CHF 50K approved vendor list path)"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-creation-1",
                    type: "video",
                    label: "SAP Ariba: PR→PO Conversion — Ordered Status",
                    videoPath: "/data/sap_ariba_po_creation_fpr001.webm"
                },
                {
                    id: "email-po-dispatch-1",
                    type: "email_draft",
                    label: "Outgoing PO Email to Sigma-Aldrich",
                    data: {
                        isIncoming: false,
                        to: "sigma-aldrich@sial.com",
                        cc: "elena.kowalski@ferring.com, procurement-ch@ferring.com",
                        subject: "Purchase Order PO-2026-00847 — Ferring International Center SA",
                        body: "Dear Sigma-Aldrich Chemie GmbH Team,\n\nPlease find attached Purchase Order PO-2026-00847 issued by Ferring International Center SA.\n\nOrder Details:\n  PO Number:      PO-2026-00847\n  PR Reference:   PR-2026-00847\n  Order Date:     2026-03-26\n  Payment Terms:  Net 30\n  Currency:       CHF\n  Total Amount:   CHF 12,450.00\n\nLine Items:\n  1. Acetonitrile HPLC Grade — 10 L × CHF 285.00 = CHF 2,850.00\n  2. Methanol HPLC Grade — 10 L × CHF 210.00 = CHF 2,100.00\n  3. Trifluoroacetic Acid (TFA) 500 mL ×5 — 5 units × CHF 1,500.00 = CHF 7,500.00\n\nDelivery Address:\n  Ferring R&D Lab, Building C\n  Route du Pertuis-du-Sault 1\n  1163 Saint-Prex, Switzerland\n\nRequested Delivery: within 10 business days of this order.\n\nPlease confirm receipt of this PO and provide an expected delivery date.\n\nBest regards,\nFerring Procurement Automation (Pace)\nprocurement-ch@ferring.com"
                    }
                }
            ]
        },

        // ── STAGE 4: Supplier Confirmation Email ─────────────────────────────────────
        {
            id: "step-5",
            title_p: "Monitoring inbox for supplier confirmation and invoice from Sigma-Aldrich...",
            title_s: "Supplier confirmation received — PO-2026-00847 accepted, invoice INV-SA-2026-4721 validated, Ariba updated to Confirmed",
            reasoning: [
                "Monitoring procurement-ch@ferring.com inbox for reply from sigma-aldrich@sial.com",
                "Email received from sigma-aldrich@sial.com at 14:07 UTC — subject: RE: Purchase Order PO-2026-00847",
                "Pace reads and comprehends email: PO-2026-00847 confirmed accepted by Sigma-Aldrich",
                "Attachment: Sigma_Aldrich_INV_SA_2026_4721.pdf (3 pages, 389 KB) — downloaded",
                "Invoice validation against PO:",
                "  Supplier name on invoice: Sigma-Aldrich Chemie GmbH — matches PO ✓",
                "  Invoice total: CHF 12,450.00 — exact match to PO ✓",
                "  Line items: Acetonitrile CHF 2,850 / Methanol CHF 2,100 / TFA CHF 7,500 — all match ✓",
                "  Payment terms: Net 30 — matches PO ✓",
                "  Delivery ETA: 2026-04-04 (7 business days) — within 10-day window ✓",
                "Desktop agent updated PO-2026-00847 in SAP Ariba: status Ordered → Confirmed",
                "Invoice INV-SA-2026-4721 attached to PO record in Ariba"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-confirmed-1",
                    type: "video",
                    label: "SAP Ariba: PO Updated to Confirmed Status",
                    videoPath: "/data/sap_ariba_po_confirmed_fpr001.webm"
                },
                {
                    id: "email-supplier-confirm-1",
                    type: "email_draft",
                    label: "Incoming: Supplier Confirmation + Invoice",
                    data: {
                        isIncoming: true,
                        from: "sigma-aldrich@sial.com",
                        to: "procurement-ch@ferring.com",
                        cc: "elena.kowalski@ferring.com",
                        subject: "RE: Purchase Order PO-2026-00847 — Ferring International Center SA",
                        body: "Dear Ferring Procurement Team,\n\nThank you for Purchase Order PO-2026-00847. We are pleased to confirm acceptance of this order.\n\nOrder Confirmation:\n  PO Number:        PO-2026-00847\n  Our Reference:    SA-ORD-2026-8841\n  Confirmed Total:  CHF 12,450.00\n  Payment Terms:    Net 30\n  Expected Delivery: 04 April 2026\n\nPlease find our Invoice INV-SA-2026-4721 attached for your records. Payment is due 30 days from invoice date (25 April 2026).\n\nIf you have any questions regarding this order, please do not hesitate to contact us.\n\nBest regards,\nSigma-Aldrich Chemie GmbH — Order Management\nsigma-aldrich@sial.com"
                    }
                },
                {
                    id: "invoice-pdf-1",
                    type: "file",
                    label: "Invoice — Sigma-Aldrich INV-SA-2026-4721",
                    pdfPath: "/data/sigma_aldrich_invoice_fpr001.pdf"
                }
            ]
        },

        // ── STAGE 5: Goods Receipt Confirmation ──────────────────────────────────────
        {
            id: "step-6",
            title_p: "Monitoring inbox for goods receipt confirmation from Sigma-Aldrich...",
            title_s: "Goods receipt confirmed — delivery verified against PO-2026-00847, Ariba updated to Invoiced, process complete",
            reasoning: [
                "Automated trigger active — monitoring for delivery receipt email from sigma-aldrich@sial.com",
                "Email received 2026-04-04 at 09:22 UTC — subject: Delivery Confirmation PO-2026-00847",
                "Pace reads email: Sigma-Aldrich confirms shipment delivered to Ferring R&D Lab, Building C, Saint-Prex",
                "Delivery receipt number: DLV-SA-2026-8841 | Carrier: DHL Express | Tracking: DHL-9830047291",
                "Verification against PO-2026-00847:",
                "  PO reference on receipt: PO-2026-00847 — matches ✓",
                "  All 3 line items confirmed delivered (Acetonitrile, Methanol, TFA) ✓",
                "  Delivery date: 2026-04-04 — within committed window (by 2026-04-04) ✓",
                "  Delivery address: Ferring R&D Lab, Building C, Saint-Prex — matches PO ✓",
                "Receipt PDF downloaded: Sigma_Aldrich_DLV_SA_2026_8841.pdf (2 pages, 201 KB)",
                "Desktop agent updated PO-2026-00847 in SAP Ariba: status Confirmed → Invoiced",
                "Goods receipt document attached to PO record in Ariba",
                "Process FPR_001 complete — full PR-to-PO lifecycle executed end-to-end without human intervention",
                "Total duration: 9 days 23 hours (PR creation to goods receipt) | Automated processing time: 1m 18s"
            ],
            artifacts: [
                {
                    id: "v-ariba-po-invoiced-1",
                    type: "video",
                    label: "SAP Ariba: PO Updated to Invoiced Status",
                    videoPath: "/data/sap_ariba_po_invoiced_fpr001.webm"
                },
                {
                    id: "email-goods-receipt-1",
                    type: "email_draft",
                    label: "Incoming: Goods Receipt Confirmation",
                    data: {
                        isIncoming: true,
                        from: "sigma-aldrich@sial.com",
                        to: "procurement-ch@ferring.com",
                        cc: "elena.kowalski@ferring.com",
                        subject: "Delivery Confirmation — Purchase Order PO-2026-00847",
                        body: "Dear Ferring Procurement Team,\n\nWe are pleased to confirm that the following order has been delivered in full:\n\nDelivery Details:\n  PO Number:          PO-2026-00847\n  Delivery Reference: DLV-SA-2026-8841\n  Delivery Date:      04 April 2026\n  Carrier:            DHL Express\n  Tracking Number:    DHL-9830047291\n\nItems Delivered:\n  1. Acetonitrile HPLC Grade — 10 L ✓\n  2. Methanol HPLC Grade — 10 L ✓\n  3. Trifluoroacetic Acid (TFA) 500 mL ×5 — 5 units ✓\n\nDelivery Address:\n  Ferring R&D Lab, Building C\n  Route du Pertuis-du-Sault 1\n  1163 Saint-Prex, Switzerland\n\nAll items have been shipped and delivered as per PO-2026-00847. Please find the delivery note attached.\n\nThank you for your business.\n\nBest regards,\nSigma-Aldrich Chemie GmbH — Logistics\nsigma-aldrich@sial.com"
                    }
                },
                {
                    id: "receipt-pdf-1",
                    type: "file",
                    label: "Delivery Receipt — DLV-SA-2026-8841",
                    pdfPath: "/data/sigma_aldrich_receipt_fpr001.pdf"
                }
            ]
        }
    ];

    // ── Execution loop ────────────────────────────────────────────────────────────
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

        if (isFinal) {
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
