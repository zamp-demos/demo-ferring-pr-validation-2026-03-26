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
        // STEP 1: ServiceNow ticket pickup
        {
            id: "step-1",
            title_p: "Desktop agent connecting to ServiceNow...",
            title_s: "ServiceNow ticket INC-2026-04891 picked up — PR-2026-01203 identified",
            reasoning: [
                "Agent logged into ServiceNow portal (ferring.service-now.com)",
                "Navigated to My Assigned Tickets queue",
                "Found ticket INC-2026-04891 — Priority: Medium",
                "Read Category: Procurement / Purchase Requisition Approval",
                "Read Description: 'PR-2026-01203 for Thermo Fisher Scientific laboratory equipment requires validation and approval — please process.'",
                "Read Requested by: Jennifer Martinez (US Lab Operations)",
                "Extracted PR reference: PR-2026-01203",
                "Updated ticket status: New → In Progress"
            ],
            artifacts: [
                {
                    id: "v-snow-5",
                    type: "video",
                    label: "Desktop Agent: ServiceNow INC-2026-04891",
                    videoPath: "/data/servicenow_ticket_fpr005.webm"
                },
                {
                    id: "snow-ticket-5",
                    type: "json",
                    label: "ServiceNow Ticket Data",
                    data: {
                        ticket_id: "INC-2026-04891",
                        category: "Procurement / PR Approval",
                        pr_reference: "PR-2026-01203",
                        priority: "Medium",
                        requester: "Jennifer Martinez",
                        description: "PR-2026-01203 for Thermo Fisher Scientific lab equipment requires validation and approval.",
                        created: "2026-03-26T09:30:00Z",
                        status: "In Progress"
                    }
                }
            ]
        },
        // STEP 2: ServiceNow→SAP handoff — field-by-field reading (NEW)
        {
            id: "step-2",
            title_p: "Reading ServiceNow ticket fields — mapping to SAP Ariba context...",
            title_s: "Handoff complete — all ServiceNow fields mapped to SAP Ariba parameters",
            reasoning: [
                "Read ticket field 'PR Number': PR-2026-01203 → SAP Ariba search key",
                "Read ticket field 'Company Code': 4100 → entity: Ferring Pharmaceuticals Inc.",
                "Read ticket field 'Requester': Jennifer Martinez → cross-reference in SAP Ariba requester field",
                "Read ticket field 'Supplier': Thermo Fisher Scientific → expected SAP supplier name",
                "Read ticket field 'Estimated Amount': USD 67,850.00 → amount to verify against PR",
                "Read ticket field 'Priority': Medium → no SLA escalation required",
                "Read ticket field 'Region': US (Parsippany, NJ) → SHIP-US-001 expected",
                "All fields extracted — switching to SAP Ariba for full PR pull"
            ],
            artifacts: [
                {
                    id: "snow-field-map-5",
                    type: "json",
                    label: "ServiceNow → SAP Ariba Field Mapping",
                    data: {
                        handoff_fields: [
                            { snow_field: "PR Number", snow_value: "PR-2026-01203", sap_target: "PR search key" },
                            { snow_field: "Company Code", snow_value: "4100", sap_target: "Company Code filter" },
                            { snow_field: "Requester", snow_value: "Jennifer Martinez", sap_target: "Requester field cross-check" },
                            { snow_field: "Supplier", snow_value: "Thermo Fisher Scientific", sap_target: "Supplier name validation" },
                            { snow_field: "Estimated Amount", snow_value: "USD 67,850.00", sap_target: "PR total cross-check" },
                            { snow_field: "Region", snow_value: "US — Parsippany, NJ", sap_target: "Ship-To code SHIP-US-001" }
                        ],
                        handoff_status: "Complete — all fields mapped"
                    }
                }
            ]
        },
        // STEP 3: SAP Ariba — read all PR fields
        {
            id: "step-3",
            title_p: "Desktop agent navigating SAP Ariba — reading all PR-2026-01203 fields...",
            title_s: "PR-2026-01203 retrieved — all fields read, Thermo Fisher Scientific, USD 67,850.00",
            reasoning: [
                "Authenticated to SAP Ariba as pace.agent@ferring.com",
                "Searched PR-2026-01203 — found in pending approvals",
                "Field by field from PR detail view:",
                "  PR ID: PR-2026-01203 ✓ (matches ServiceNow reference)",
                "  Company Code: 4100 — Ferring Pharmaceuticals Inc. ✓ (matches ServiceNow)",
                "  Requester: Jennifer Martinez ✓ (matches ServiceNow)",
                "  Budget Owner: Dr. Michael Torres (≠ Jennifer — segregation confirmed)",
                "  Supplier: Thermo Fisher Scientific (Supplier ID: SUP-10245)",
                "  Cost Center: CC-US-LAB-001",
                "  Total Amount: USD 67,850.00 ✓ (matches ServiceNow estimate)",
                "  Currency: USD",
                "  Region: US (Parsippany, NJ)"
            ],
            artifacts: [
                {
                    id: "v-ariba-5",
                    type: "video",
                    label: "Desktop Agent: SAP Ariba PR-2026-01203 Detail",
                    videoPath: "/data/sap_ariba_pr_fpr005.webm"
                },
                {
                    id: "pr-header-5",
                    type: "json",
                    label: "PR-2026-01203 Header — All Fields",
                    data: {
                        pr_id: "PR-2026-01203",
                        company_code: "4100",
                        entity: "Ferring Pharmaceuticals Inc.",
                        requester: "Jennifer Martinez",
                        budget_owner: "Dr. Michael Torres",
                        cost_center: "CC-US-LAB-001",
                        supplier: "Thermo Fisher Scientific",
                        supplier_id: "SUP-10245",
                        currency: "USD",
                        total_amount: "67,850.00",
                        region: "US — Parsippany, NJ",
                        snow_cross_check: "All 6 fields match ServiceNow ticket ✓"
                    }
                }
            ]
        },
        // STEP 4: Extract line items
        {
            id: "step-4",
            title_p: "Extracting all 4 PR line items and enriching supplier data...",
            title_s: "4 line items extracted — USD 67,850.00 confirmed, Thermo Fisher SUP-10245 verified",
            reasoning: [
                "Line 1: Analytical Balance (0.1mg resolution) — 1 unit × USD 12,500.00",
                "Line 2: High-Speed Centrifuge — 1 unit × USD 28,750.00",
                "Line 3: Multi-Channel Pipette Set — 1 set × USD 8,600.00",
                "Line 4: UV-Vis Spectrophotometer — 1 unit × USD 18,000.00",
                "Sum: USD 12,500 + USD 28,750 + USD 8,600 + USD 18,000 = USD 67,850.00 ✓",
                "All 4 lines reference Material Group: MG-EQP-001",
                "Supplier master: Thermo Fisher Scientific Inc. (SUP-10245) — Active, no blocks"
            ],
            artifacts: [
                {
                    id: "line-items-5",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            { line: "1", description: "Analytical Balance (0.1mg)", qty: "1 unit", unit_price: "USD 12,500.00", total: "USD 12,500.00" },
                            { line: "2", description: "High-Speed Centrifuge", qty: "1 unit", unit_price: "USD 28,750.00", total: "USD 28,750.00" },
                            { line: "3", description: "Multi-Channel Pipette Set", qty: "1 set", unit_price: "USD 8,600.00", total: "USD 8,600.00" },
                            { line: "4", description: "UV-Vis Spectrophotometer", qty: "1 unit", unit_price: "USD 18,000.00", total: "USD 18,000.00" }
                        ],
                        sum_check: "USD 67,850.00 = PR total ✓"
                    }
                }
            ]
        },
        // STEP 5: Download + classify attachment
        {
            id: "step-5",
            title_p: "Downloading and classifying attachment...",
            title_s: "Validation 1/14: Purchase Order identified (confidence: 0.91) — downloaded",
            reasoning: [
                "Found 1 attachment: ThermoFisher_PO_2026_01203.pdf (2 pages, 198KB)",
                "Document type: Purchase Order (confidence: 0.91)",
                "PO Date: 2026-03-18",
                "Expected Delivery: 2026-04-15"
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
        // STEP 6: Extract + validate V2-V7
        {
            id: "step-6",
            title_p: "Extracting structured data and running validations 2-7...",
            title_s: "Data extracted — Validations 2-7 all PASS",
            reasoning: [
                "Extracted: PO total USD 67,850.00 — exact match with PR ✓",
                "V2 Accounting: CC-US-LAB-001, GL 21400200 — consistent ✓ PASS",
                "V3 Budget Owner: Dr. Michael Torres ≠ Jennifer Martinez — segregation confirmed ✓ PASS",
                "V4 Currency: USD consistent across PO and all 4 line items ✓ PASS",
                "V5 Material Group: MG-EQP-001 linked to GL 21400200 in approved master ✓ PASS",
                "V6 Supplier: Thermo Fisher Scientific — 98% match SUP-10245 (Inc. vs without) ✓ PASS",
                "V7 Pricing: USD 67,850.00 = USD 67,850.00 exact match ✓ PASS"
            ]
        },
        // STEP 7: Validation V8-V14
        {
            id: "step-7",
            title_p: "Running validations 8-14...",
            title_s: "Validations 8-14 all PASS — clean sweep, auto-approval confirmed",
            reasoning: [
                "V8 Service Type: Equipment HSN codes valid for laboratory instrumentation ✓ PASS",
                "V9 Ordering: EMAIL, orders@thermofisher.com valid, domain verified ✓ PASS",
                "V10 Ship-To: SHIP-US-001 (Parsippany facility) linked to company code 4100 ✓ PASS",
                "V11 Sold-To: 4100 = 4100, entity name confirmed ✓ PASS",
                "V12 Company Code: Ferring Pharmaceuticals Inc. — confidence 0.99 ✓ PASS",
                "V13 Quantity: All 4 line items match individually at Level 1 ✓ PASS",
                "V14 Deliver-To: Ferring Labs, 100 Interpace Pkwy, Parsippany NJ — valid ✓ PASS"
            ],
            artifacts: [
                {
                    id: "val-sum-5",
                    type: "json",
                    label: "Validation Summary",
                    data: {
                        overall_status: "PASS",
                        passed: 14, failed: 0, manual_review: 0,
                        validation_results: {
                            attachment: "PASS", accounting: "PASS", budget_owner: "PASS",
                            currency: "PASS", material_group: "PASS", supplier_id: "PASS",
                            pricing: "PASS", service_type: "PASS", ordering_method: "PASS",
                            ship_to: "PASS", sold_to: "PASS", company_code: "PASS",
                            quantity: "PASS", deliver_to: "PASS"
                        }
                    }
                }
            ]
        },
        // STEP 8: SAP Ariba approval
        {
            id: "step-8",
            title_p: "Approving PR in SAP Ariba...",
            title_s: "PR-2026-01203 approved in SAP Ariba — status: Pending → Approved",
            reasoning: [
                "Desktop agent navigated to PR-2026-01203 in SAP Ariba",
                "Selected 'Approve' from approver actions menu",
                "Typed approval comment: 'All 14 validation checks passed (100%). PO USD 67,850.00 matches PR exactly. Thermo Fisher Scientific (SUP-10245) verified. Auto-approved by Pace. ServiceNow ref: INC-2026-04891.'",
                "Status: Pending Approval → Approved",
                "Confirmation received (200 OK)"
            ],
            artifacts: [
                {
                    id: "ariba-confirm-5",
                    type: "json",
                    label: "SAP Ariba Approval Confirmation",
                    data: {
                        action: "APPROVED",
                        pr_id: "PR-2026-01203",
                        status_before: "Pending Approval",
                        status_after: "Approved",
                        approval_comment: "All 14 validations passed. PO matches PR. Thermo Fisher SUP-10245 verified. ServiceNow: INC-2026-04891.",
                        timestamp: "2026-03-26T10:15:00Z",
                        api_response: "200 OK",
                        approved_by: "Pace Automation Agent"
                    }
                }
            ]
        },
        // STEP 9: Resolve ServiceNow ticket
        {
            id: "step-9",
            title_p: "Returning to ServiceNow — updating ticket INC-2026-04891...",
            title_s: "ServiceNow ticket INC-2026-04891 resolved — full resolution notes posted",
            reasoning: [
                "Returned to ServiceNow portal",
                "Opened ticket INC-2026-04891",
                "Posted work note: 'PR-2026-01203 validated successfully — 14/14 checks passed. All ServiceNow fields cross-checked against SAP Ariba PR. USD 67,850.00 confirmed. Thermo Fisher Scientific SUP-10245 verified. PR approved in SAP Ariba at 10:15 UTC.'",
                "Updated ticket status: In Progress → Resolved",
                "Resolution code: Procurement — Auto-approved (no issues)",
                "Closure confirmation received"
            ],
            artifacts: [
                {
                    id: "snow-resolved-5",
                    type: "json",
                    label: "ServiceNow Ticket Resolved",
                    data: {
                        ticket_id: "INC-2026-04891",
                        status_before: "In Progress",
                        status_after: "Resolved",
                        resolution_note: "PR-2026-01203 validated and approved. 14/14 checks passed. All fields verified against SAP Ariba. PR approved at 10:15 UTC.",
                        resolved_by: "Pace Automation Agent",
                        timestamp: "2026-03-26T10:16:00Z"
                    }
                }
            ]
        },
        // STEP 10: Audit trail
        {
            id: "step-10",
            title_p: "Finalizing audit trail...",
            title_s: "Process complete — PR-2026-01203 approved via ServiceNow→SAP Ariba flow",
            reasoning: [
                "Processing duration: 48 seconds",
                "Systems accessed: ServiceNow (INC-2026-04891), SAP Ariba (PR-2026-01203)",
                "ServiceNow→SAP Ariba handoff: 6 fields cross-checked — all matched",
                "Validations: 14 run, 14 passed",
                "HITL gates: 0 — full auto-approve path",
                "ServiceNow ticket: Resolved",
                "SAP Ariba PR: Approved"
            ]
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;

        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: step.title_p,
            status: 'processing'
        });
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
