const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_001";
const CASE_NAME = "Standard PR Auto-Approval";

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
        // STEP 1: SAP Ariba login
        {
            id: "step-1",
            title_p: "Desktop agent connecting to SAP Ariba...",
            title_s: "Connected to SAP Ariba — authenticated successfully",
            reasoning: [
                "Agent logged in as pace.agent@ferring.com",
                "Session established with SAP Ariba production instance (SESS-2026-03-26-1015)",
                "Authentication token valid for 8 hours",
                "Navigating to pending approvals queue"
            ],
            artifacts: [
                {
                    id: "v-ariba-1",
                    type: "video",
                    label: "Desktop Agent: SAP Ariba Login + PR-2026-00847",
                    videoPath: "/data/sap_ariba_login_fpr001.webm"
                }
            ]
        },
        // STEP 2: Retrieve PR
        {
            id: "step-2",
            title_p: "Retrieving pending Purchase Requisitions...",
            title_s: "PR-2026-00847 retrieved from approval queue",
            reasoning: [
                "Queried pending approvals for agent queue",
                "Found 6 pending PRs — selected PR-2026-00847 (FIFO order)",
                "Opened PR detail view",
                "Reading header fields..."
            ],
            artifacts: [
                {
                    id: "pr-header-1",
                    type: "json",
                    label: "PR-2026-00847 Header Data",
                    data: {
                        pr_id: "PR-2026-00847",
                        company_code: "1000",
                        entity: "Ferring International Center SA",
                        requester: "Elena Kowalski",
                        budget_owner: "Dr. Marcus Weber",
                        po_owner: "Elena Kowalski",
                        cost_center: "CC-RD-4521",
                        currency: "CHF",
                        total_amount: "12,450.00",
                        supplier: "Sigma-Aldrich Chemie GmbH",
                        supplier_id: "SUP-88421",
                        region: "Switzerland (EMEA)",
                        line_items: 3
                    }
                }
            ]
        },
        // STEP 3: Extract line items
        {
            id: "step-3",
            title_p: "Extracting PR line items and supplier details...",
            title_s: "3 line items extracted — CHF 12,450.00 total, Sigma-Aldrich Chemie GmbH",
            reasoning: [
                "Clicked 'Line Items' tab in PR detail view",
                "Line 1: Analytical Grade Reagents — 10 units × CHF 420.00 = CHF 4,200.00",
                "Line 2: HPLC Columns (C18 250mm) — 5 units × CHF 1,150.00 = CHF 5,750.00",
                "Line 3: Lab Consumables Kit — 5 units × CHF 500.00 = CHF 2,500.00",
                "Sum: CHF 4,200 + CHF 5,750 + CHF 2,500 = CHF 12,450.00 — matches PR total ✓",
                "All lines reference Material Group: MG-LAB-001"
            ],
            artifacts: [
                {
                    id: "line-items-1",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            { line: "1", description: "Analytical Grade Reagents", qty: "10 units", unit_price: "CHF 420.00", total: "CHF 4,200.00" },
                            { line: "2", description: "HPLC Columns C18 250mm", qty: "5 units", unit_price: "CHF 1,150.00", total: "CHF 5,750.00" },
                            { line: "3", description: "Lab Consumables Kit", qty: "5 units", unit_price: "CHF 500.00", total: "CHF 2,500.00" }
                        ],
                        sum_check: "CHF 12,450.00 = PR total ✓"
                    }
                }
            ]
        },
        // STEP 4: Download + classify attachment
        {
            id: "step-4",
            title_p: "Downloading and validating attachments...",
            title_s: "Validation 1/14: Quotation identified (confidence: 0.95) — downloaded",
            reasoning: [
                "Clicked 'Attachments' tab in PR detail view",
                "Found 1 attachment: Sigma_Aldrich_Q2026_0847.pdf (2 pages, 312KB)",
                "Document classification model applied",
                "Document type: Quotation (confidence: 0.95)",
                "File format valid (PDF/A compliant)",
                "Downloaded to processing queue"
            ],
            artifacts: [
                {
                    id: "pdf-1",
                    type: "file",
                    label: "Quotation — Sigma-Aldrich Q2026-0847",
                    pdfPath: "/data/sigma_aldrich_quotation_q2026.pdf"
                }
            ]
        },
        // STEP 5: Extract quotation data
        {
            id: "step-5",
            title_p: "Extracting structured data from quotation...",
            title_s: "Structured data extracted — all fields populated, no discrepancies",
            reasoning: [
                "Extracted Supplier: Sigma-Aldrich Chemie GmbH, Buchs, Switzerland",
                "Extracted Amount: CHF 12,450.00 — exact match with PR total ✓",
                "Extracted Currency: CHF — matches PR currency ✓",
                "Extracted 3 line items — descriptions, quantities, unit prices match PR ✓",
                "Quote date: 2026-03-15, Valid until: 2026-06-15",
                "No discrepancies detected at extraction stage"
            ],
            artifacts: [
                {
                    id: "extracted-1",
                    type: "json",
                    label: "Extracted Quotation Data",
                    data: {
                        supplier_name: "Sigma-Aldrich Chemie GmbH",
                        supplier_address: "Industriestrasse 25, 9471 Buchs, Switzerland",
                        total_amount: "CHF 12,450.00",
                        currency: "CHF",
                        document_date: "2026-03-15",
                        valid_until: "2026-06-15",
                        line_items: [
                            { description: "Analytical Grade Reagents", quantity: 10, unit_price: 420.00, total: 4200.00 },
                            { description: "HPLC Columns C18 250mm", quantity: 5, unit_price: 1150.00, total: 5750.00 },
                            { description: "Lab Consumables Kit", quantity: 5, unit_price: 500.00, total: 2500.00 }
                        ]
                    }
                }
            ]
        },
        // STEP 6: Supplier Master verification (NEW)
        {
            id: "step-6",
            title_p: "Verifying supplier against Ferring Supplier Master...",
            title_s: "Supplier Master: Sigma-Aldrich Chemie GmbH (SUP-88421) — Active, verified PASS",
            reasoning: [
                "Opened Ferring Supplier Master portal",
                "Searched 'Sigma-Aldrich' — found SUP-88421: Sigma-Aldrich Chemie GmbH (Active)",
                "Name match: 'Sigma-Aldrich Chemie GmbH' — exact match with PR and quotation ✓",
                "Supplier status: Active — no purchasing blocks, no compliance flags",
                "Registration date: 2015-09-01, Region: EMEA",
                "V6 Supplier Validation: PASS (confidence 0.99)"
            ],
            artifacts: [
                {
                    id: "supplier-master-1",
                    type: "json",
                    label: "Supplier Master Verification",
                    data: {
                        search_term: "Sigma-Aldrich",
                        result: { supplier_id: "SUP-88421", name: "Sigma-Aldrich Chemie GmbH", status: "Active", region: "EMEA", registration_date: "2015-09-01", entity_type: "Trading Entity" },
                        pr_supplier_name: "Sigma-Aldrich Chemie GmbH",
                        quotation_supplier_name: "Sigma-Aldrich Chemie GmbH",
                        match: "EXACT MATCH ✓",
                        v6_result: "PASS"
                    }
                }
            ]
        },
        // STEP 7: Validation suite V2-V8
        {
            id: "step-7",
            title_p: "Running comprehensive validation suite (14 domains)...",
            title_s: "Validations 2-8 complete: Accounting, Budget Owner, Currency, Material Group, Supplier, Pricing, Service Type — all PASS",
            reasoning: [
                "V2 Accounting: Assignment K, Cost Center CC-RD-4521, GL 51200100 — consistent ✓ PASS",
                "V3 Budget Owner: Dr. Marcus Weber ≠ Elena Kowalski (requester) — segregation of duties confirmed ✓ PASS",
                "V4 Currency: CHF matches across quotation and all 3 PR line items ✓ PASS",
                "V5 Material Group: MG-LAB-001 linked to GL 51200100 in approved master list ✓ PASS",
                "V6 Supplier: Sigma-Aldrich Chemie GmbH — exact match SUP-88421 via Supplier Master (0.99 confidence) ✓ PASS",
                "V7 Pricing: PR total CHF 12,450.00 = Quotation total CHF 12,450.00 — exact match, 0.00% variance ✓ PASS",
                "V8 Service Type: SAC code 998599 valid, strong classification confidence (0.91) ✓ PASS"
            ]
        },
        // STEP 8: Validation suite V9-V14
        {
            id: "step-8",
            title_p: "Completing validation suite (domains 9-14)...",
            title_s: "Validations 9-14 complete: Ordering, Ship-To, Sold-To, Company Code, Quantity, Deliver-To — all PASS",
            reasoning: [
                "V9 Ordering: EMAIL method — sigma-aldrich@sial.com valid, domain @sial.com matches Sigma-Aldrich registered contact ✓ PASS",
                "V10 Ship-To: SHIP-CH-001 valid, linked to company code 1000 ✓ PASS",
                "V11 Sold-To: 1000 = 1000, entity name Ferring International Center SA confirmed ✓ PASS",
                "V12 Company Code: Ferring International Center SA — high confidence (0.97) ✓ PASS",
                "V13 Quantity: All 3 line items quantities match at Level 1 (individual item quantities verified) ✓ PASS",
                "V14 Deliver-To: Ferring R&D Lab, Building C, Saint-Prex — valid and consistent ✓ PASS"
            ]
        },
        // STEP 9: Validation summary
        {
            id: "step-9",
            title_p: "Generating validation summary...",
            title_s: "Overall status: PASS — all 14/14 validations passed with zero exceptions",
            reasoning: [
                "Total validations run: 14",
                "Passed: 14 (100%)",
                "Failed: 0",
                "Manual Review required: 0",
                "Aggregate confidence score: 0.97 (very high)",
                "Recommendation: Auto-approve PR — no human review required"
            ],
            artifacts: [
                {
                    id: "val-summary-1",
                    type: "json",
                    label: "Validation Summary",
                    data: {
                        overall_status: "PASS",
                        total_validations: 14,
                        passed: 14,
                        failed: 0,
                        manual_review: 0,
                        aggregate_confidence: 0.97,
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
        // STEP 10: SAP Ariba approval
        {
            id: "step-10",
            title_p: "Approving PR in SAP Ariba...",
            title_s: "PR-2026-00847 approved in SAP Ariba — status: Pending → Approved",
            reasoning: [
                "Desktop agent returned to SAP Ariba PR-2026-00847",
                "Selected 'Approve' action from approver actions menu",
                "Typed approval comment: 'All 14 validation checks passed (100%). Quotation CHF 12,450.00 matches PR exactly. Supplier Sigma-Aldrich Chemie GmbH (SUP-88421) verified via Supplier Master. Auto-approved by Pace.'",
                "Status changed: Pending Approval → Approved",
                "Approval confirmation received (200 OK)",
                "No email notification required — full auto-approve path"
            ],
            artifacts: [
                {
                    id: "v-ariba-approve-1",
                    type: "video",
                    label: "Desktop Agent: SAP Ariba Approval",
                    videoPath: "/data/sap_ariba_login_fpr001.webm"
                },
                {
                    id: "ariba-confirm-1",
                    type: "json",
                    label: "SAP Ariba Approval Confirmation",
                    data: {
                        action: "APPROVED",
                        pr_id: "PR-2026-00847",
                        status_before: "Pending Approval",
                        status_after: "Approved",
                        approval_comment: "All 14 validation checks passed (100%). Quotation CHF 12,450.00 matches PR exactly. Supplier Sigma-Aldrich Chemie GmbH (SUP-88421) verified. Auto-approved by Pace.",
                        timestamp: "2026-03-26T10:15:42Z",
                        api_response: "200 OK",
                        approved_by: "Pace Automation Agent"
                    }
                }
            ]
        },
        // STEP 11: Audit trail
        {
            id: "step-11",
            title_p: "Finalizing and logging audit trail...",
            title_s: "Process complete — PR-2026-00847 auto-approved, audit trail archived",
            reasoning: [
                "Processing duration: 42 seconds",
                "Systems accessed: SAP Ariba, Ferring Supplier Master",
                "14 validations run — all passed",
                "0 HITL gates triggered — full auto-approve",
                "Supplier Master verification: Sigma-Aldrich Chemie GmbH (SUP-88421) confirmed",
                "All artifacts archived for compliance and audit"
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
