const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_005";
const CASE_NAME = "US ServiceNow Flow";

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

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    const steps = [

        // ── STAGE 1: ServiceNow queue pickup ──────────────────────────────────
        {
            id: "step-1",
            title_p: "Checking ServiceNow queue for assigned tickets...",
            title_s: "ServiceNow ticket INC-2026-04891 picked up — PR-2026-01203, Thermo Fisher Scientific, USD 67,850.00",
            reasoning: [
                "Logged into ServiceNow portal (ferring.service-now.com) as Zamp.ai_test",
                "Queried 'My Work' queue — filtered by Assignment Group: Zamp.ai_test",
                "Found 1 new ticket: INC-2026-04891",
                "  Category: Procurement / PR Approval",
                "  Short description: PR-2026-01203 — Thermo Fisher Scientific, USD 67,850.00, US Parsippany",
                "  Submitted by: Jennifer Martinez (US Lab Operations)",
                "  Priority: Medium",
                "Opened ticket INC-2026-04891 — extracted PR reference: PR-2026-01203",
                "Updated ticket status: New → In Progress",
                "Initiating PR validation workflow"
            ],
            artifacts: [
                {
                    id: "v-snow-5",
                    type: "video",
                    label: "ServiceNow: Ticket INC-2026-04891 Pickup",
                    videoPath: "/data/servicenow_ticket_fpr005.webm"
                },
                {
                    id: "snow-ticket-5",
                    type: "json",
                    label: "ServiceNow Ticket INC-2026-04891",
                    data: {
                        ticket_id: "INC-2026-04891",
                        category: "Procurement / PR Approval",
                        pr_reference: "PR-2026-01203",
                        submitted_by: "Jennifer Martinez",
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
        },

        // ── STAGE 2: Authentication and PR retrieval ──────────────────────────
        {
            id: "step-2",
            title_p: "Authenticating to SAP Ariba and retrieving PR details...",
            title_s: "Connected to SAP Ariba — PR-2026-01203 opened, Thermo Fisher Scientific, USD 67,850.00",
            reasoning: [
                "Authenticated to SAP Ariba as pace.agent@ferring.com",
                "Session established — navigated to Manage → Purchase Requisitions",
                "Searched PR-2026-01203 — found in pending approvals queue",
                "Opened PR detail view",
                "PR header fields read:",
                "  PR ID: PR-2026-01203 ✓ (matches ServiceNow reference)",
                "  Company Code: 4100 — Ferring Pharmaceuticals Inc.",
                "  Requester: Jennifer Martinez ✓ (matches ServiceNow)",
                "  Budget Owner: Dr. Michael Torres (≠ Jennifer — segregation confirmed)",
                "  PO Owner: US Procurement Operations",
                "  Cost Center: CC-US-LAB-001",
                "  Supplier: Thermo Fisher Scientific (Supplier ID: SUP-10245)",
                "  Currency: USD",
                "  Total Amount: USD 67,850.00 ✓ (matches ServiceNow estimate)",
                "  Region: US — Parsippany, NJ"
            ],
            artifacts: [
                {
                    id: "v-ariba-5",
                    type: "video",
                    label: "SAP Ariba: PR-2026-01203 Detail View",
                    videoPath: "/data/sap_ariba_pr_fpr005.webm"
                },
                {
                    id: "pr-header-5",
                    type: "json",
                    label: "PR-2026-01203 Header",
                    data: {
                        pr_id: "PR-2026-01203",
                        company_code: "4100",
                        entity: "Ferring Pharmaceuticals Inc.",
                        requester: "Jennifer Martinez",
                        budget_owner: "Dr. Michael Torres",
                        po_owner: "US Procurement Operations",
                        cost_center: "CC-US-LAB-001",
                        currency: "USD",
                        total_amount: "67,850.00",
                        supplier: "Thermo Fisher Scientific",
                        supplier_id: "SUP-10245",
                        region: "US — Parsippany, NJ",
                        line_items_count: 4
                    }
                }
            ]
        },

        // ── STAGE 3: Data extraction and supplier enrichment ──────────────────
        {
            id: "step-3",
            title_p: "Extracting PR data — header fields, line items, and supplier enrichment...",
            title_s: "4 line items extracted — USD 67,850.00 total, supplier enriched via Supplier Master",
            reasoning: [
                "Clicked 'Line Items' tab in PR detail view",
                "Line 1: Analytical Balance (0.1mg resolution) — 1 unit × USD 12,500.00 = USD 12,500.00",
                "Line 2: High-Speed Centrifuge — 1 unit × USD 28,750.00 = USD 28,750.00",
                "Line 3: Multi-Channel Pipette Set — 1 set × USD 8,600.00 = USD 8,600.00",
                "Line 4: UV-Vis Spectrophotometer — 1 unit × USD 18,000.00 = USD 18,000.00",
                "Sum: USD 12,500 + USD 28,750 + USD 8,600 + USD 18,000 = USD 67,850.00 ✓ — matches PR header",
                "All 4 lines reference Material Group: MG-EQP-001",
                "Supplier Master enrichment: searched Ferring Supplier Master for 'Thermo Fisher Scientific'",
                "  Record found: SUP-10245 — Thermo Fisher Scientific Inc., Active, no purchasing blocks",
                "  Registered address: 168 Third Avenue, Waltham, MA 02451, USA",
                "  Ordering method: EMAIL — orders@thermofisher.com",
                "  Payment terms: NET-30",
                "  Supplier status: Active — compliant, no flags"
            ],
            artifacts: [
                {
                    id: "line-items-5",
                    type: "json",
                    label: "PR Line Items + Supplier Enrichment",
                    data: {
                        line_items: [
                            { line: "1", description: "Analytical Balance (0.1mg resolution)", qty: "1 unit", unit_price: "USD 12,500.00", total: "USD 12,500.00" },
                            { line: "2", description: "High-Speed Centrifuge", qty: "1 unit", unit_price: "USD 28,750.00", total: "USD 28,750.00" },
                            { line: "3", description: "Multi-Channel Pipette Set", qty: "1 set", unit_price: "USD 8,600.00", total: "USD 8,600.00" },
                            { line: "4", description: "UV-Vis Spectrophotometer", qty: "1 unit", unit_price: "USD 18,000.00", total: "USD 18,000.00" }
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
        },

        // ── STAGE 4: Attachment processing (Validation 1/14) ─────────────────
        {
            id: "step-4",
            title_p: "Checking attachments tab — downloading and classifying documents...",
            title_s: "Validation 1/14: Purchase Order identified (confidence: 0.91) — downloaded",
            reasoning: [
                "Clicked 'Attachments' tab in PR detail view",
                "Found 1 attachment: ThermoFisher_PO_2026_01203.pdf (2 pages, 198KB)",
                "Downloaded and classified document",
                "Document type: Purchase Order (confidence: 0.91)",
                "PO Date: 2026-03-18",
                "Vendor reference: TF-PO-2026-01203",
                "Expected Delivery: 2026-04-15",
                "Validation 1/14 — Attachment: PASS"
            ],
            artifacts: [
                {
                    id: "pdf-5",
                    type: "file",
                    label: "PO — Thermo Fisher Scientific",
                    pdfPath: "/data/thermo_fisher_po_2026.pdf"
                }
            ]
        },

        // ── STAGE 5: Structured data extraction from document ─────────────────
        {
            id: "step-5",
            title_p: "Extracting structured data from Purchase Order...",
            title_s: "Structured data extracted — PO total USD 67,850.00 matches PR exactly",
            reasoning: [
                "Parsed ThermoFisher_PO_2026_01203.pdf",
                "Extracted: Vendor — Thermo Fisher Scientific Inc.",
                "Extracted: Bill-To — Ferring Pharmaceuticals Inc., 100 Interpace Pkwy, Parsippany NJ 07054",
                "Extracted: PO Date — 2026-03-18",
                "Extracted: PO Number — TF-PO-2026-01203",
                "Extracted: 4 line items matching PR line item descriptions",
                "Extracted: PO Total — USD 67,850.00",
                "Cross-check: PO total USD 67,850.00 = PR total USD 67,850.00 ✓",
                "Cross-check: Supplier name 'Thermo Fisher Scientific Inc.' matches SUP-10245 ✓",
                "No discrepancies found — document data consistent with PR"
            ],
            artifacts: [
                {
                    id: "po-extracted-5",
                    type: "json",
                    label: "PO Extracted Data",
                    data: {
                        document_type: "Purchase Order",
                        confidence: 0.91,
                        vendor: "Thermo Fisher Scientific Inc.",
                        bill_to: "Ferring Pharmaceuticals Inc., 100 Interpace Pkwy, Parsippany NJ 07054",
                        po_number: "TF-PO-2026-01203",
                        po_date: "2026-03-18",
                        po_total: "USD 67,850.00",
                        pr_total: "USD 67,850.00",
                        match: "EXACT MATCH ✓",
                        delivery_date: "2026-04-15"
                    }
                }
            ]
        },

        // ── STAGE 6: Comprehensive validation V2–V14 ─────────────────────────
        {
            id: "step-6",
            title_p: "Running comprehensive validation suite — domains 2 through 14...",
            title_s: "Validations 2–14 complete — all 13 PASS, 14/14 overall clean sweep",
            reasoning: [
                "V2  Accounting: CC-US-LAB-001 valid, GL 21400200 linked correctly ✓ PASS",
                "V3  Budget Owner: Dr. Michael Torres ≠ Jennifer Martinez — segregation of duties confirmed ✓ PASS",
                "V4  Currency: USD consistent across PR header, all 4 line items, and PO ✓ PASS",
                "V5  Material Group: MG-EQP-001 linked to GL 21400200 in approved master ✓ PASS",
                "V6  Supplier ID: 'Thermo Fisher Scientific Inc.' — 98% match to SUP-10245 (Inc. suffix variant) ✓ PASS",
                "V7  Pricing: PO total USD 67,850.00 = PR total USD 67,850.00 — exact match ✓ PASS",
                "V8  Service Type: HSN codes valid for laboratory instrumentation ✓ PASS",
                "V9  Ordering Method: EMAIL, orders@thermofisher.com — domain verified ✓ PASS",
                "V10 Ship-To: SHIP-US-001 (Parsippany facility) linked to company code 4100 ✓ PASS",
                "V11 Sold-To: Company code 4100 = Ferring Pharmaceuticals Inc. ✓ PASS",
                "V12 Company Code: Ferring Pharmaceuticals Inc. — confidence 0.99 ✓ PASS",
                "V13 Quantity: All 4 line items match PO quantities individually ✓ PASS",
                "V14 Deliver-To: Ferring Labs, 100 Interpace Pkwy, Parsippany NJ — valid ✓ PASS",
                "Overall result: 14/14 PASS — zero failures, zero manual reviews"
            ],
            artifacts: [
                {
                    id: "val-summary-5",
                    type: "json",
                    label: "Validation Summary — 14/14 PASS",
                    data: {
                        overall_status: "PASS",
                        passed: 14, failed: 0, manual_review: 0,
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
        },

        // ── STAGE 7: Auto-approve in SAP Ariba ───────────────────────────────
        {
            id: "step-7",
            title_p: "Overall status: PASS — auto-approving PR-2026-01203 in SAP Ariba...",
            title_s: "PR-2026-01203 approved in SAP Ariba — status: Pending Approval → Approved",
            reasoning: [
                "All 14 validation checks passed — auto-approval path confirmed",
                "Desktop agent navigated to PR-2026-01203 in SAP Ariba",
                "Selected 'Approve' from approver actions menu",
                "Entered approval comment: 'All 14 validation checks passed (14/14). PO USD 67,850.00 matches PR exactly. Thermo Fisher Scientific SUP-10245 verified. Auto-approved by Pace. ServiceNow ref: INC-2026-04891.'",
                "Confirmed approval — status: Pending Approval → Approved",
                "Confirmation received (200 OK)",
                "Approval timestamp: 2026-03-26T10:15:00Z"
            ],
            artifacts: [
                {
                    id: "v-ariba-approve-5",
                    type: "video",
                    label: "SAP Ariba: PR-2026-01203 Approval",
                    videoPath: "/data/sap_ariba_pr_fpr005.webm"
                },
                {
                    id: "ariba-confirm-5",
                    type: "json",
                    label: "SAP Ariba Approval Confirmation",
                    data: {
                        action: "APPROVED",
                        pr_id: "PR-2026-01203",
                        status_before: "Pending Approval",
                        status_after: "Approved",
                        approval_comment: "All 14 validations passed. PO USD 67,850.00 exact match. Thermo Fisher SUP-10245 verified. ServiceNow: INC-2026-04891.",
                        approved_by: "Pace Automation Agent",
                        timestamp: "2026-03-26T10:15:00Z",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 9: ServiceNow ticket resolved + audit trail ─────────────────
        {
            id: "step-8",
            title_p: "Updating ServiceNow ticket INC-2026-04891 with approval outcome...",
            title_s: "ServiceNow ticket INC-2026-04891 resolved — validation summary posted, ticket closed",
            reasoning: [
                "Returned to ServiceNow portal",
                "Opened ticket INC-2026-04891",
                "Posted resolution work note:",
                "  'PR-2026-01203 validated and approved. 14/14 checks passed. All fields verified against SAP Ariba PR. USD 67,850.00 confirmed. Thermo Fisher Scientific SUP-10245 verified. PR approved in SAP Ariba at 10:15 UTC.'",
                "Updated ticket status: In Progress → Resolved",
                "Resolution code: Procurement — Auto-approved (no issues)",
                "Resolution timestamp: 2026-03-26T10:16:00Z",
                "Closure confirmation received",
                "Audit trail complete — process FPR_005 finished",
                "Total duration: ~48 seconds (excluding system latency)",
                "HITL gates triggered: 0 — full straight-through processing"
            ],
            artifacts: [
                {
                    id: "v-snow-resolved-5",
                    type: "video",
                    label: "ServiceNow: Ticket INC-2026-04891 Resolved",
                    videoPath: "/data/servicenow_ticket_fpr005.webm"
                },
                {
                    id: "snow-resolved-5",
                    type: "json",
                    label: "ServiceNow Ticket Resolved",
                    data: {
                        ticket_id: "INC-2026-04891",
                        status_before: "In Progress",
                        status_after: "Resolved",
                        resolution_note: "PR-2026-01203 validated and approved. 14/14 checks passed. PO USD 67,850.00 exact match. Thermo Fisher SUP-10245 verified. PR approved in SAP Ariba at 10:15 UTC.",
                        resolution_code: "Procurement — Auto-approved (no issues)",
                        resolved_by: "Pace Automation Agent",
                        timestamp: "2026-03-26T10:16:00Z"
                    }
                },
                {
                    id: "audit-trail-5",
                    type: "json",
                    label: "Process Audit Trail",
                    data: {
                        process_id: "FPR_005",
                        pr_id: "PR-2026-01203",
                        servicenow_ticket: "INC-2026-04891",
                        started: "2026-03-26T09:30:00Z",
                        completed: "2026-03-26T10:16:00Z",
                        outcome: "APPROVED",
                        systems_accessed: ["ServiceNow", "SAP Ariba"],
                        attachments_processed: 1,
                        validations: { run: 14, passed: 14, failed: 0 },
                        hitl_gates: 0,
                        sap_ariba_status: "Approved",
                        servicenow_status: "Resolved"
                    }
                }
            ]
        }

    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
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
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
