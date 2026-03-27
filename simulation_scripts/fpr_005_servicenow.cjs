const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_005";
const CASE_NAME = "US ServiceNow PR-to-PO Lifecycle";

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
        title_s: "ServiceNow ticket INC-2026-04891 picked up — PR-2026-01203, Thermo Fisher Scientific, USD 67,850.00",
        reasoning: [
            "Logged into ServiceNow portal (ferring.service-now.com) as Zamp.ai_test",
            "Queried 'My Work' queue — filtered by Assignment Group: Zamp.ai_test",
            "Found 1 new ticket: INC-2026-04891",
            "  Category: Procurement / PR Approval",
            "  Short description: PR-2026-01203 — Thermo Fisher Scientific, USD 67,850.00, US Parsippany",
            "  Submitted by: Jennifer Morrison (US Lab Operations)",
            "  Priority: Medium",
            "Opened ticket INC-2026-04891 — extracted PR reference: PR-2026-01203",
            "Updated ticket status: New → In Progress",
            "Initiating PR validation workflow"
        ],
        artifacts: [
            {
                id: "v-snow-5a",
                type: "video",
                label: "ServiceNow: Ticket INC-2026-04891 Pickup",
                videoPath: "/data/servicenow_pickup_fpr005.webm"
            },
            {
                id: "snow-ticket-5",
                type: "json",
                label: "ServiceNow Ticket INC-2026-04891",
                data: {
                    ticket_id: "INC-2026-04891",
                    category: "Procurement / PR Approval",
                    pr_reference: "PR-2026-01203",
                    submitted_by: "Jennifer Morrison",
                    supplier: "Thermo Fisher Scientific",
                    amount: "USD 67,850.00",
                    region: "US — Parsippany, NJ",
                    priority: "Medium",
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
        title_p: "Authenticating to SAP Ariba and retrieving PR-2026-01203...",
        title_s: "SAP Ariba: PR-2026-01203 opened — Thermo Fisher Scientific, USD 67,850.00, 4 line items, 3 attachments",
        reasoning: [
            "Authenticated to SAP Ariba as pace.agent@ferring.com — session established",
            "Navigated to Manage → Purchase Requisitions",
            "Searched PR-2026-01203 — found in pending approvals queue",
            "Opened PR detail view — status: Pending Approval",
            "PR header fields read:",
            "  PR ID: PR-2026-01203 ✓ (matches ServiceNow reference)",
            "  Company Code: 4100 — Ferring Pharmaceuticals Inc.",
            "  Requester: Jennifer Morrison ✓ (matches ServiceNow submission)",
            "  Budget Owner: Dr. David Chen (US Lab Sciences)",
            "  PO Owner: US Procurement Operations",
            "  Cost Center: CC-US-LAB-002",
            "  Preferred Ordering Method: EMAIL",
            "  Supplier: Thermo Fisher Scientific (Supplier ID: SUP-10245)",
            "  Currency: USD",
            "  Total Amount: USD 67,850.00 ✓ (matches ServiceNow estimate)",
            "  Region: US — Parsippany, NJ",
            "Clicked Line Items tab — 4 line items found",
            "Clicked Attachments tab — 3 attachments found: 1 PO + 2 Quotations"
        ],
        artifacts: [
            {
                id: "v-ariba-5b",
                type: "video",
                label: "SAP Ariba: PR-2026-01203 Detail View",
                videoPath: "/data/sap_ariba_queue_fpr005.webm"
            },
            {
                id: "pr-header-5",
                type: "json",
                label: "PR-2026-01203 Header Data",
                data: {
                    pr_id: "PR-2026-01203",
                    company_code: "4100",
                    entity: "Ferring Pharmaceuticals Inc.",
                    requester: "Jennifer Morrison",
                    budget_owner: "Dr. David Chen",
                    po_owner: "US Procurement Operations",
                    cost_center: "CC-US-LAB-002",
                    preferred_ordering_method: "EMAIL",
                    currency: "USD",
                    total_amount: "67,850.00",
                    supplier: "Thermo Fisher Scientific",
                    supplier_id: "SUP-10245",
                    region: "US — Parsippany, NJ",
                    line_items_count: 4,
                    attachments_count: 3,
                    status: "Pending Approval"
                }
            }
        ]
    };

    // ── STAGE 1 STEP C: Line items + supplier enrichment ────────────────────────
    const step1c = {
        id: "step-1c",
        title_p: "Extracting line items and enriching supplier data from Supplier Master...",
        title_s: "4 line items extracted — USD 67,850.00 verified, Thermo Fisher Scientific SUP-10245 enriched",
        reasoning: [
            "Line 1: Analytical Balance (0.1mg resolution) — 1 unit × USD 12,500.00 = USD 12,500.00, MG-EQP-001",
            "Line 2: High-Speed Centrifuge — 1 unit × USD 28,750.00 = USD 28,750.00, MG-EQP-001",
            "Line 3: Multi-Channel Pipette Set — 1 set × USD 8,600.00 = USD 8,600.00, MG-EQP-001",
            "Line 4: UV-Vis Spectrophotometer — 1 unit × USD 18,000.00 = USD 18,000.00, MG-EQP-001",
            "Sum check: USD 12,500 + USD 28,750 + USD 8,600 + USD 18,000 = USD 67,850.00 ✓ — matches PR header",
            "Ship-To: SHIP-US-001 (Parsippany facility), Sold-To: Company Code 4100",
            "Account Type: Cost Center, GL: 21400200 (Lab Equipment)",
            "Supplier Master enrichment: queried Ferring Supplier Master for 'Thermo Fisher Scientific'",
            "  Record found: SUP-10245 — Thermo Fisher Scientific Inc., Active",
            "  Registered address: 168 Third Avenue, Waltham, MA 02451, USA",
            "  Ordering method: EMAIL — orders@thermofisher.com",
            "  Payment terms: NET-30",
            "  Purchasing blocks: None — compliant, no flags"
        ],
        artifacts: [
            {
                id: "line-items-5",
                type: "json",
                label: "PR Line Items + Supplier Enrichment",
                data: {
                    line_items: [
                        { line: "1", description: "Analytical Balance (0.1mg resolution)", qty: "1 unit", unit_price: "USD 12,500.00", total: "USD 12,500.00", material_group: "MG-EQP-001", gl: "21400200" },
                        { line: "2", description: "High-Speed Centrifuge", qty: "1 unit", unit_price: "USD 28,750.00", total: "USD 28,750.00", material_group: "MG-EQP-001", gl: "21400200" },
                        { line: "3", description: "Multi-Channel Pipette Set", qty: "1 set", unit_price: "USD 8,600.00", total: "USD 8,600.00", material_group: "MG-EQP-001", gl: "21400200" },
                        { line: "4", description: "UV-Vis Spectrophotometer", qty: "1 unit", unit_price: "USD 18,000.00", total: "USD 18,000.00", material_group: "MG-EQP-001", gl: "21400200" }
                    ],
                    sum_check: "USD 67,850.00 = PR header total ✓",
                    supplier_master: {
                        supplier_id: "SUP-10245",
                        name: "Thermo Fisher Scientific Inc.",
                        status: "Active",
                        address: "168 Third Avenue, Waltham, MA 02451, USA",
                        ordering_method: "EMAIL — orders@thermofisher.com",
                        payment_terms: "NET-30",
                        purchasing_blocks: "None"
                    }
                }
            }
        ]
    };

    // ── STAGE 2: Attachment processing + full validation suite ──────────────────
    const step2a = {
        id: "step-2a",
        title_p: "Processing 3 attachments — classifying and extracting structured data...",
        title_s: "Validation 1/14: 3 documents classified — PO (conf. 0.91) + Quotation A (conf. 0.94) + Quotation B (conf. 0.93)",
        reasoning: [
            "Clicked 'Attachments' tab in PR detail view",
            "Found 3 attachments:",
            "  Attachment 1: ThermoFisher_PO_2026_01203.pdf (2 pages, 198KB)",
            "    Classified: Purchase Order (confidence: 0.91)",
            "    PO Date: 2026-03-18 | Vendor ref: TF-PO-2026-01203 | Total: USD 67,850.00",
            "  Attachment 2: Quotation_ThermoFisher_Q1_2026.pdf (3 pages, 245KB)",
            "    Classified: Quotation (confidence: 0.94)",
            "    Quote No: TF-Q-2026-0441 | Valid until: 2026-04-30 | Amount: USD 67,850.00",
            "  Attachment 3: Quotation_LabEquip_Comparison_2026.pdf (4 pages, 312KB)",
            "    Classified: Quotation (confidence: 0.93)",
            "    Comparison quote from alternative lab equipment distributor — reference pricing",
            "Spend threshold check: USD 67,850.00 — falls in $50,000–$75,000 band",
            "  Policy: minimum 2 quotations required",
            "  Quotations found: 2 ✓ — requirement satisfied",
            "Validation 1/14 — Attachment: PASS (PO + 2 Quotations, 2-quote requirement met)"
        ],
        artifacts: [
            {
                id: "pdf-po-5",
                type: "file",
                label: "PO — Thermo Fisher Scientific (TF-PO-2026-01203)",
                pdfPath: "/data/thermo_fisher_po_2026.pdf"
            },
            {
                id: "attach-summary-5",
                type: "json",
                label: "Attachment Classification Summary",
                data: {
                    total_attachments: 3,
                    documents: [
                        { filename: "ThermoFisher_PO_2026_01203.pdf", type: "Purchase Order", confidence: 0.91, amount: "USD 67,850.00" },
                        { filename: "Quotation_ThermoFisher_Q1_2026.pdf", type: "Quotation", confidence: 0.94, quote_no: "TF-Q-2026-0441", valid_until: "2026-04-30" },
                        { filename: "Quotation_LabEquip_Comparison_2026.pdf", type: "Quotation", confidence: 0.93, note: "Comparison pricing — alternative distributor" }
                    ],
                    spend_band: "$50,000–$75,000",
                    quotes_required: 2,
                    quotes_found: 2,
                    quote_requirement: "SATISFIED ✓",
                    "V1_Attachment": "PASS"
                }
            }
        ]
    };

    const step2b = {
        id: "step-2b",
        title_p: "Running full validation suite — domains 2 through 14...",
        title_s: "Validations 2–14 complete — 13 PASS, 0 FAIL — 14/14 overall clean sweep",
        reasoning: [
            "V2  Accounting: CC-US-LAB-002 valid, GL 21400200 linked to MG-EQP-001 in approved master ✓ PASS",
            "V3  Budget Owner: Dr. David Chen ≠ Jennifer Morrison — segregation of duties confirmed ✓ PASS",
            "V4  Currency: USD consistent across PR header, all 4 line items, and PO ✓ PASS",
            "V5  Material Group: MG-EQP-001 linked to GL 21400200 for laboratory equipment ✓ PASS",
            "V6  Supplier ID: 'Thermo Fisher Scientific Inc.' — 98% match to SUP-10245 (Inc. suffix variant) ✓ PASS",
            "V7  Pricing: PO total USD 67,850.00 = PR total USD 67,850.00 — exact match ✓ PASS",
            "V8  Service Type: HSN codes valid for laboratory instrumentation ✓ PASS",
            "V9  Ordering Method: EMAIL, orders@thermofisher.com — domain verified ✓ PASS",
            "V10 Ship-To: SHIP-US-001 (Parsippany facility) linked to company code 4100 ✓ PASS",
            "V11 Sold-To: Company code 4100 = Ferring Pharmaceuticals Inc. ✓ PASS",
            "V12 Company Code: Ferring Pharmaceuticals Inc. — confidence 0.99 ✓ PASS",
            "V13 Quantity: All 4 line items match PO quantities individually ✓ PASS",
            "V14 Deliver-To: Ferring Labs, 100 Interpace Pkwy, Parsippany NJ — valid ✓ PASS",
            "Overall result: 14/14 PASS — zero failures, zero manual reviews required"
        ],
        artifacts: [
            {
                id: "v-ariba-approve-5",
                type: "video",
                label: "SAP Ariba: PR-2026-01203 Approval",
                videoPath: "/data/sap_ariba_approval_fpr005.webm"
            },
            {
                id: "val-summary-5",
                type: "json",
                label: "Validation Summary — 14/14 PASS",
                data: {
                    overall_status: "PASS",
                    passed: 14, failed: 0, manual_review: 0,
                    spend_band: "$50,000–$75,000",
                    quote_policy: "2 quotes required — 2 present ✓",
                    results: {
                        "V1 Attachment": "PASS",
                        "V2 Accounting": "PASS",
                        "V3 Budget Owner": "PASS",
                        "V4 Currency": "PASS",
                        "V5 Material Group": "PASS",
                        "V6 Supplier ID": "PASS",
                        "V7 Pricing": "PASS",
                        "V8 Service Type": "PASS",
                        "V9 Ordering Method": "PASS",
                        "V10 Ship-To": "PASS",
                        "V11 Sold-To": "PASS",
                        "V12 Company Code": "PASS",
                        "V13 Quantity": "PASS",
                        "V14 Deliver-To": "PASS"
                    }
                }
            }
        ]
    };

    // ── STAGE 3: HITL gate — PO email to Thermo Fisher ─────────────────────────
    const step3_hitl = {
        id: "step-3",
        title_p: "All validations PASS — drafting PO dispatch email to Thermo Fisher Scientific...",
        title_s: "PO email drafted — HITL Gate: awaiting procurement approval to send",
        reasoning: [
            "14/14 validations passed — PO dispatch approved for straight-through processing",
            "Drafted PO email to orders@thermofisher.com",
            "  To: orders@thermofisher.com",
            "  CC: jennifer.morrison@ferring.com, dr.david.chen@ferring.com, procurement-us@ferring.com",
            "  Subject: Purchase Order PO-2026-01203 — Ferring Pharmaceuticals Inc.",
            "  Attachment: ThermoFisher_PO_2026_01203.pdf — 4 lab equipment items, USD 67,850.00",
            "  Delivery requested by: 2026-04-15",
            "  Ordering method confirmed: EMAIL (per SUP-10245 supplier master)",
            "Human approval required before sending — HITL gate"
        ],
        artifacts: [
            {
                id: "po-email-draft-5",
                type: "email_draft",
                label: "Email Draft: PO Dispatch to Thermo Fisher Scientific",
                data: {
                    isIncoming: false,
                    to: "orders@thermofisher.com",
                    cc: "jennifer.morrison@ferring.com, dr.david.chen@ferring.com, procurement-us@ferring.com",
                    subject: "Purchase Order PO-2026-01203 — Ferring Pharmaceuticals Inc.",
                    body: "Dear Thermo Fisher Scientific Team,\n\nPlease find attached Purchase Order PO-2026-01203 issued by Ferring Pharmaceuticals Inc. (Company Code 4100).\n\nOrder details:\n   PO Number:       PO-2026-01203\n   PR Reference:    PR-2026-01203\n   Order Date:      2026-03-26\n   Requested by:    Jennifer Morrison, US Lab Operations\n   Approved by:     Dr. David Chen, US Lab Sciences\n\nLine items:\n   1. Analytical Balance (0.1mg resolution)  — 1 unit       — USD 12,500.00\n   2. High-Speed Centrifuge                  — 1 unit       — USD 28,750.00\n   3. Multi-Channel Pipette Set              — 1 set        — USD  8,600.00\n   4. UV-Vis Spectrophotometer               — 1 unit       — USD 18,000.00\n   ─────────────────────────────────────────────────────────────────────────\n   Total:                                                     USD 67,850.00\n\nDelivery address:\n   Ferring Pharmaceuticals Inc. — US Lab Facility\n   100 Interpace Pkwy, Parsippany, NJ 07054, USA\n   Requested delivery date: 2026-04-15\n\nPayment terms: NET-30\n\nPlease confirm receipt of this purchase order and advise on expected delivery timeline.\n\nBest regards,\nFerring Pharmaceuticals — US Procurement\nprocurement-us@ferring.com"
                }
            },
            {
                id: "pdf-po-dispatch-5",
                type: "file",
                label: "PO Attachment — Thermo Fisher Scientific",
                pdfPath: "/data/thermo_fisher_po_2026.pdf"
            }
        ]
    };

    // ── STAGE 3 POST-HITL: PR → PO conversion in SAP Ariba ────────────────────
    const step3b = {
        id: "step-3b",
        title_p: "PO email sent — converting PR-2026-01203 to PO in SAP Ariba...",
        title_s: "PR-2026-01203 converted to PO in SAP Ariba — status: Approved → Ordered (PO-2026-01203)",
        reasoning: [
            "PO dispatch email approved and sent to orders@thermofisher.com",
            "Desktop agent re-authenticated to SAP Ariba as pace.agent@ferring.com",
            "Navigated to PR-2026-01203 in approved state",
            "Selected 'Create Order' from actions menu to convert PR → PO",
            "Confirmed PO details:",
            "  PO Number auto-assigned: PO-2026-01203",
            "  Supplier: Thermo Fisher Scientific Inc. (SUP-10245)",
            "  Total: USD 67,850.00 — 4 line items confirmed",
            "  Delivery date: 2026-04-15",
            "Submitted conversion — status changed: Approved → Ordered",
            "Confirmation received (200 OK)",
            "PO creation timestamp: 2026-03-26T10:45:00Z",
            "ServiceNow ref INC-2026-04891 added to PO comment field"
        ],
        artifacts: [
            {
                id: "v-ariba-po-5",
                type: "video",
                label: "SAP Ariba: PO-2026-01203 Creation",
                videoPath: "/data/sap_ariba_po_creation_fpr005.webm"
            },
            {
                id: "po-created-5",
                type: "json",
                label: "PO Creation Confirmation",
                data: {
                    action: "PR → PO CONVERSION",
                    pr_id: "PR-2026-01203",
                    po_number: "PO-2026-01203",
                    status_before: "Approved",
                    status_after: "Ordered",
                    supplier: "Thermo Fisher Scientific Inc. (SUP-10245)",
                    total: "USD 67,850.00",
                    delivery_date: "2026-04-15",
                    created_by: "Pace Automation Agent",
                    timestamp: "2026-03-26T10:45:00Z",
                    servicenow_ref: "INC-2026-04891",
                    api_response: "200 OK"
                }
            }
        ]
    };

    // ── STAGE 4: Confirmation email from Thermo Fisher ─────────────────────────
    const step4 = {
        id: "step-4",
        title_p: "Monitoring inbox for PO confirmation from Thermo Fisher Scientific...",
        title_s: "PO confirmation + invoice received from Thermo Fisher — validated, PO updated to Confirmed",
        reasoning: [
            "Email received from orders@thermofisher.com at 14:22 UTC",
            "Subject: RE: Purchase Order PO-2026-01203 — Order Confirmed + Invoice Attached",
            "Thermo Fisher confirms receipt of PO-2026-01203",
            "Expected delivery date confirmed: 2026-04-14 (one day ahead of requested date)",
            "Invoice attached: TF_Invoice_INV-2026-TF-00891.pdf (2 pages, 212KB)",
            "  Classified: Invoice (confidence: 0.97)",
            "  Invoice No: INV-2026-TF-00891",
            "  Invoice Date: 2026-03-26",
            "  Invoice Total: USD 67,850.00",
            "Cross-validation of invoice against PO:",
            "  Supplier: Thermo Fisher Scientific Inc. ✓ matches SUP-10245",
            "  Invoice total USD 67,850.00 = PO total USD 67,850.00 ✓ exact match",
            "  All 4 line item descriptions match PO ✓",
            "  All 4 quantities match PO ✓",
            "  All 4 unit prices match PO ✓",
            "Invoice validation: PASS — no discrepancies",
            "Updated PO-2026-01203 status in SAP Ariba: Ordered → Confirmed",
            "Invoice PDF attached to PO record in SAP Ariba"
        ],
        artifacts: [
            {
                id: "v-ariba-confirmed-5",
                type: "video",
                label: "SAP Ariba: PO-2026-01203 Updated to Confirmed",
                videoPath: "/data/sap_ariba_po_confirmed_fpr005.webm"
            },
            {
                id: "supplier-confirmation-5",
                type: "email_draft",
                label: "Incoming: Thermo Fisher PO Confirmation + Invoice",
                data: {
                    isIncoming: true,
                    from: "orders@thermofisher.com",
                    to: "procurement-us@ferring.com",
                    subject: "RE: Purchase Order PO-2026-01203 — Order Confirmed + Invoice Attached",
                    body: "Dear Ferring Procurement Team,\n\nThank you for Purchase Order PO-2026-01203 dated 26 March 2026.\n\nWe confirm receipt and acceptance of this order. Details:\n\n   PO Reference:    PO-2026-01203\n   Order Value:     USD 67,850.00\n   Expected Delivery: 14 April 2026 (Parsippany, NJ facility)\n\nPlease find attached Invoice INV-2026-TF-00891 for the full order amount of USD 67,850.00.\n\nPlease contact us with any questions regarding this order.\n\nBest regards,\nThermo Fisher Scientific — Order Management\norders@thermofisher.com"
                }
            },
            {
                id: "invoice-validation-5",
                type: "json",
                label: "Invoice Validation vs PO",
                data: {
                    invoice_no: "INV-2026-TF-00891",
                    invoice_date: "2026-03-26",
                    invoice_total: "USD 67,850.00",
                    po_total: "USD 67,850.00",
                    match: "EXACT MATCH ✓",
                    line_items_match: "4/4 ✓",
                    quantities_match: "4/4 ✓",
                    prices_match: "4/4 ✓",
                    supplier_match: "Thermo Fisher Scientific Inc. = SUP-10245 ✓",
                    validation_result: "PASS",
                    ariba_status_before: "Ordered",
                    ariba_status_after: "Confirmed",
                    delivery_confirmed: "2026-04-14"
                }
            }
        ]
    };

    // ── STAGE 5 STEP A: Goods receipt confirmation ─────────────────────────────
    const step5a = {
        id: "step-5a",
        title_p: "Monitoring inbox for delivery receipt from Thermo Fisher Scientific...",
        title_s: "Delivery receipt received — all 4 items confirmed delivered, PO updated to Invoiced",
        reasoning: [
            "Email received from orders@thermofisher.com at 09:04 UTC on 2026-04-14",
            "Subject: Delivery Receipt — PO-2026-01203 — All Items Delivered",
            "Thermo Fisher confirms full delivery to Parsippany facility",
            "Delivery manifest attached: TF_Delivery_DR-2026-01203.pdf",
            "  Delivery Date: 2026-04-14",
            "  Delivered To: Jennifer Morrison, US Lab Facility, 100 Interpace Pkwy, Parsippany NJ",
            "  Items delivered:",
            "    Line 1: Analytical Balance (0.1mg) × 1 ✓ received",
            "    Line 2: High-Speed Centrifuge × 1 ✓ received",
            "    Line 3: Multi-Channel Pipette Set × 1 ✓ received",
            "    Line 4: UV-Vis Spectrophotometer × 1 ✓ received",
            "All 4 line items confirmed delivered — no shortages, no damages reported",
            "PO reference PO-2026-01203 verified ✓ matches Ariba record",
            "Updated PO-2026-01203 in SAP Ariba: Confirmed → Invoiced",
            "Goods receipt posted — invoice INV-2026-TF-00891 matched and cleared"
        ],
        artifacts: [
            {
                id: "v-ariba-invoiced-5",
                type: "video",
                label: "SAP Ariba: PO-2026-01203 Updated to Invoiced",
                videoPath: "/data/sap_ariba_po_invoiced_fpr005.webm"
            },
            {
                id: "receipt-email-5",
                type: "email_draft",
                label: "Incoming: Thermo Fisher Delivery Receipt",
                data: {
                    isIncoming: true,
                    from: "orders@thermofisher.com",
                    to: "procurement-us@ferring.com",
                    subject: "Delivery Receipt — PO-2026-01203 — All Items Delivered",
                    body: "Dear Ferring Procurement Team,\n\nWe are pleased to confirm that all items for Purchase Order PO-2026-01203 have been successfully delivered.\n\nDelivery details:\n   Delivery Date:  14 April 2026\n   Delivered To:   Jennifer Morrison, US Lab Facility\n                   100 Interpace Pkwy, Parsippany, NJ 07054\n\nItems delivered:\n   1. Analytical Balance (0.1mg resolution)  × 1  — DELIVERED ✓\n   2. High-Speed Centrifuge                  × 1  — DELIVERED ✓\n   3. Multi-Channel Pipette Set              × 1  — DELIVERED ✓\n   4. UV-Vis Spectrophotometer               × 1  — DELIVERED ✓\n\nAll items delivered in full. No shortages or damages to report.\n\nThank you for your business.\n\nBest regards,\nThermo Fisher Scientific — Logistics\norders@thermofisher.com"
                }
            },
            {
                id: "goods-receipt-5",
                type: "json",
                label: "Goods Receipt & PO Status Update",
                data: {
                    po_number: "PO-2026-01203",
                    delivery_date: "2026-04-14",
                    delivered_to: "Jennifer Morrison, Parsippany NJ facility",
                    items_delivered: 4,
                    items_expected: 4,
                    delivery_complete: true,
                    invoice_no: "INV-2026-TF-00891",
                    invoice_cleared: true,
                    ariba_status_before: "Confirmed",
                    ariba_status_after: "Invoiced",
                    goods_receipt_posted: true,
                    timestamp: "2026-04-14T09:18:00Z"
                }
            }
        ]
    };

    // ── STAGE 5 STEP B: ServiceNow ticket resolution ────────────────────────────
    const step5b = {
        id: "step-5b",
        title_p: "Resolving ServiceNow ticket INC-2026-04891 with full validation summary...",
        title_s: "ServiceNow ticket INC-2026-04891 resolved — PR-to-PO lifecycle complete, process Done",
        reasoning: [
            "Returned to ServiceNow portal (ferring.service-now.com)",
            "Opened ticket INC-2026-04891",
            "Posted resolution work note:",
            "  'PR-2026-01203 fully processed. 14/14 validations passed. 2 quotations verified (USD 50K–75K band). PO-2026-01203 issued to Thermo Fisher Scientific (SUP-10245) for USD 67,850.00. PO Confirmed 2026-03-26. Goods delivered 2026-04-14. PO status: Invoiced. All steps complete.'",
            "Updated ticket status: In Progress → Resolved",
            "Resolution code: Procurement — Auto-approved, PO issued and fulfilled",
            "Resolution timestamp: 2026-04-14T09:20:00Z",
            "Closure confirmation received",
            "Audit trail complete — FPR_005 process finished",
            "Total end-to-end duration: 19 days (PR raised → goods received)",
            "Agent processing time: ~90 seconds (excluding HITL wait and delivery lead time)",
            "HITL gates triggered: 1 (PO dispatch approval)"
        ],
        artifacts: [
            {
                id: "v-snow-resolved-5",
                type: "video",
                label: "ServiceNow: Ticket INC-2026-04891 Resolved",
                videoPath: "/data/servicenow_resolved_fpr005.webm"
            },
            {
                id: "snow-resolved-5",
                type: "json",
                label: "ServiceNow Ticket Resolved",
                data: {
                    ticket_id: "INC-2026-04891",
                    status_before: "In Progress",
                    status_after: "Resolved",
                    resolution_note: "PR-2026-01203 fully processed. 14/14 validations passed. 2 quotations verified ($50K–$75K band). PO-2026-01203 issued USD 67,850.00. Thermo Fisher SUP-10245 confirmed. Goods delivered 2026-04-14. PO: Invoiced.",
                    resolution_code: "Procurement — Auto-approved, PO issued and fulfilled",
                    resolved_by: "Pace Automation Agent",
                    timestamp: "2026-04-14T09:20:00Z"
                }
            },
            {
                id: "audit-trail-5",
                type: "json",
                label: "Process Audit Trail",
                data: {
                    process_id: "FPR_005",
                    case_name: "US ServiceNow PR-to-PO Lifecycle",
                    pr_id: "PR-2026-01203",
                    po_number: "PO-2026-01203",
                    servicenow_ticket: "INC-2026-04891",
                    supplier: "Thermo Fisher Scientific Inc. (SUP-10245)",
                    total_amount: "USD 67,850.00",
                    started: "2026-03-26T09:30:00Z",
                    completed: "2026-04-14T09:20:00Z",
                    outcome: "APPROVED — PO FULFILLED",
                    systems_accessed: ["ServiceNow", "SAP Ariba"],
                    attachments_processed: 3,
                    validations: { run: 14, passed: 14, failed: 0 },
                    quote_check: "2 quotes verified (policy: ≥2 for $50K–$75K band) ✓",
                    hitl_gates: 1,
                    ariba_final_status: "Invoiced",
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
            const sentTitle = 'PO email approved and sent to Thermo Fisher Scientific — converting PR to PO in SAP Ariba';
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

    // Stage 2: Attachments + full validation suite
    await runStep(step2a);
    await runStep(step2b);

    // Stage 3: HITL gate — PO email dispatch
    const hitlPassed = await runHitlStep(step3_hitl, 'HITL Gate: PO Email Pending Procurement Approval');
    if (!hitlPassed) return;

    // Stage 3 post-HITL: PR → PO conversion in Ariba
    await runStep(step3b);

    // Stage 4: Confirmation email + invoice validation
    await runStep(step4);

    // Stage 5: Goods receipt + ServiceNow resolution
    await runStep(step5a);
    await runStep(step5b, true);

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
