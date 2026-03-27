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
        // STAGE 1: Regional Queue Management
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
                "Queue position recorded — processing PR-2026-00847 now"
            ],
            artifacts: [
                {
                    id: "v-ariba-queue-1",
                    type: "video",
                    label: "Desktop Agent: SAP Ariba Login + PR-2026-00847",
                    videoPath: "/data/sap_ariba_login_fpr001.webm"
                }
            ]
        },
        // STAGE 2: Authentication and PR Retrieval
        {
            id: "step-2",
            title_p: "Authenticating to SAP Ariba and retrieving PR details...",
            title_s: "Connected to SAP Ariba — PR-2026-00847 opened, Sigma-Aldrich Chemie GmbH, CHF 12,450.00",
            reasoning: [
                "Authenticated as pace.agent@ferring.com — session token valid",
                "Navigated to PR-2026-00847 detail view",
                "Opened PR header: Company Code 1000, Ferring International Center SA",
                "Requester: Elena Kowalski | Budget Owner: Dr. Marcus Weber | PO Owner: Elena Kowalski",
                "Cost Center: CC-RD-4521 | Currency: CHF | Total Amount: CHF 12,450.00",
                "Supplier: Sigma-Aldrich Chemie GmbH (SUP-88421) | Region: Switzerland (EMEA)",
                "Line items count: 3 | PR status: Pending Approval"
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
        // STAGE 3: Data Extraction + Supplier Master Enrichment
        {
            id: "step-3",
            title_p: "Extracting PR data — header fields, line items, and supplier enrichment...",
            title_s: "3 line items extracted — CHF 12,450.00 total, supplier enriched via Supplier Master",
            reasoning: [
                "Clicked 'Line Items' tab in PR-2026-00847 detail view",
                "Line 1: Analytical Grade Reagents — 10 units × CHF 420.00 = CHF 4,200.00",
                "Line 2: HPLC Columns (C18 250mm) — 5 units × CHF 1,150.00 = CHF 5,750.00",
                "Line 3: Lab Consumables Kit — 5 units × CHF 500.00 = CHF 2,500.00",
                "Sum check: CHF 4,200 + CHF 5,750 + CHF 2,500 = CHF 12,450.00 — matches PR header total ✓",
                "All 3 lines reference Material Group: MG-LAB-001",
                "--- Supplier Master Enrichment ---",
                "Looked up SUP-88421 in Ferring Supplier Master database",
                "Retrieved: Sigma-Aldrich Chemie GmbH | Address: Industriestrasse 25, 9471 Buchs, Switzerland",
                "Contact email: sigma-aldrich@sial.com | Payment terms: Net 30 | Ordering method: EMAIL",
                "Supplier status: Active — no purchasing blocks, no compliance flags, no sanctions matches",
                "Registration date: 2015-09-01 | Region: EMEA | Entity type: Trading Entity",
                "Supplier enrichment complete — all fields populated for downstream validation"
            ],
            artifacts: [
                {
                    id: "line-items-1",
                    type: "json",
                    label: "PR Line Items + Supplier Enrichment",
                    data: {
                        line_items: [
                            { line: "1", description: "Analytical Grade Reagents", qty: "10 units", unit_price: "CHF 420.00", total: "CHF 4,200.00" },
                            { line: "2", description: "HPLC Columns C18 250mm", qty: "5 units", unit_price: "CHF 1,150.00", total: "CHF 5,750.00" },
                            { line: "3", description: "Lab Consumables Kit", qty: "5 units", unit_price: "CHF 500.00", total: "CHF 2,500.00" }
                        ],
                        sum_check: "CHF 12,450.00 = PR total ✓",
                        supplier_master: {
                            supplier_id: "SUP-88421",
                            name: "Sigma-Aldrich Chemie GmbH",
                            address: "Industriestrasse 25, 9471 Buchs, Switzerland",
                            email: "sigma-aldrich@sial.com",
                            payment_terms: "Net 30",
                            ordering_method: "EMAIL",
                            status: "Active",
                            region: "EMEA"
                        }
                    }
                }
            ]
        },
        // STAGE 4: Attachment Processing (Validation 1/14)
        {
            id: "step-4",
            title_p: "Checking attachments tab — downloading and classifying documents...",
            title_s: "Validation 1/14: Quotation identified (confidence: 0.95) — downloaded",
            reasoning: [
                "Clicked 'Attachments' tab in PR-2026-00847 detail view",
                "Found 1 attachment: Sigma_Aldrich_Q2026_0847.pdf (2 pages, 312 KB)",
                "Document classification model applied to PDF content",
                "Document type: Quotation — confidence: 0.95 (high)",
                "File format: valid (PDF/A compliant), no corruption detected",
                "Downloaded to processing queue for structured extraction",
                "V1 Attachment Check: PASS — supporting document present and classified"
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
        // STAGE 5: Structured Data Extraction from Document
        {
            id: "step-5",
            title_p: "Extracting structured data from Quotation...",
            title_s: "Structured data extracted — amounts match, no discrepancies found",
            reasoning: [
                "Extracted Supplier: Sigma-Aldrich Chemie GmbH, Industriestrasse 25, 9471 Buchs, Switzerland",
                "Extracted Total Amount: CHF 12,450.00 — exact match with PR total ✓",
                "Extracted Currency: CHF — matches PR currency field ✓",
                "Extracted 3 line items — descriptions, quantities, and unit prices align with PR ✓",
                "Quote date: 2026-03-15 | Valid until: 2026-06-15",
                "Supplier contact on quotation: sigma-aldrich@sial.com — matches Supplier Master record ✓",
                "No discrepancies detected at extraction stage — all key fields consistent"
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
        // STAGE 6: Comprehensive Multi-Domain Validation (V2-V14, all PASS)
        {
            id: "step-6",
            title_p: "Running comprehensive validation suite — all 14 domains...",
            title_s: "Validations 2-14 complete — all PASS (14/14, aggregate confidence: 0.97)",
            reasoning: [
                "V2 Accounting: Assignment K, Cost Center CC-RD-4521, GL 51200100 — consistent with chart of accounts ✓ PASS",
                "V3 Budget Owner: Dr. Marcus Weber ≠ Elena Kowalski (requester) — segregation of duties confirmed ✓ PASS",
                "V4 Currency: CHF consistent across PR header, all 3 line items, and quotation ✓ PASS",
                "V5 Material Group: MG-LAB-001 correctly linked to GL 51200100 in approved master list ✓ PASS",
                "V6 Supplier ID: Sigma-Aldrich Chemie GmbH — exact name match, SUP-88421 Active in Supplier Master (confidence: 0.99) ✓ PASS",
                "V7 Pricing: PR total CHF 12,450.00 = Quotation total CHF 12,450.00 — 0.00% variance ✓ PASS",
                "V8 Service Type: SAC code 998599 valid, strong classification confidence (0.91) ✓ PASS",
                "V9 Ordering Method: EMAIL — sigma-aldrich@sial.com valid, domain @sial.com matches Supplier Master ✓ PASS",
                "V10 Ship-To: SHIP-CH-001 valid, correctly linked to company code 1000 ✓ PASS",
                "V11 Sold-To: 1000 = 1000, entity name Ferring International Center SA confirmed ✓ PASS",
                "V12 Company Code: Ferring International Center SA — high confidence (0.97) ✓ PASS",
                "V13 Quantity: All 3 line item quantities verified at Level 1 — individual item quantities match quotation ✓ PASS",
                "V14 Deliver-To: Ferring R&D Lab, Building C, Saint-Prex — valid and consistent with cost center ✓ PASS",
                "Overall: 14/14 PASS | Failed: 0 | Manual Review: 0 | Aggregate confidence: 0.97 → Auto-approve eligible"
            ],
            artifacts: [
                {
                    id: "val-summary-1",
                    type: "json",
                    label: "Validation Summary — All 14 Checks",
                    data: {
                        overall_status: "PASS",
                        total_validations: 14,
                        passed: 14,
                        failed: 0,
                        manual_review: 0,
                        aggregate_confidence: 0.97,
                        validation_results: {
                            "V1_Attachment": "PASS",
                            "V2_Accounting": "PASS",
                            "V3_Budget_Owner": "PASS",
                            "V4_Currency": "PASS",
                            "V5_Material_Group": "PASS",
                            "V6_Supplier_ID": "PASS",
                            "V7_Pricing": "PASS",
                            "V8_Service_Type": "PASS",
                            "V9_Ordering_Method": "PASS",
                            "V10_Ship_To": "PASS",
                            "V11_Sold_To": "PASS",
                            "V12_Company_Code": "PASS",
                            "V13_Quantity": "PASS",
                            "V14_Deliver_To": "PASS"
                        }
                    }
                }
            ]
        },
        // STAGE 7: Automated Action — Auto-approve in SAP Ariba
        {
            id: "step-7",
            title_p: "Overall status: PASS — auto-approving PR-2026-00847 in SAP Ariba...",
            title_s: "PR-2026-00847 approved in SAP Ariba — status: Pending Approval → Approved",
            reasoning: [
                "All 14 validation checks passed — auto-approve threshold met (0 failures, 0 manual reviews)",
                "Desktop agent returned to SAP Ariba PR-2026-00847 detail view",
                "Selected 'Approve' action from approver actions menu",
                "Approval comment submitted: 'All 14 validation checks passed (100%). Quotation CHF 12,450.00 matches PR exactly. Supplier Sigma-Aldrich Chemie GmbH (SUP-88421) verified via Supplier Master. Auto-approved by Pace.'",
                "PR status changed: Pending Approval → Approved",
                "Approval confirmation received — HTTP 200 OK",
                "No HITL gate triggered — full automated approval path completed"
            ],
            artifacts: [
                {
                    id: "v-ariba-approve-1",
                    type: "video",
                    label: "Desktop Agent: SAP Ariba Approval Action",
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
                        approval_comment: "All 14 validation checks passed (100%). Quotation CHF 12,450.00 matches PR exactly. Supplier Sigma-Aldrich Chemie GmbH (SUP-88421) verified via Supplier Master. Auto-approved by Pace.",
                        timestamp: "2026-03-26T10:15:42Z",
                        api_response: "200 OK",
                        approved_by: "Pace Automation Agent (pace.agent@ferring.com)"
                    }
                }
            ]
        },
        // STAGE 9: Process Completion and Audit Trail
        {
            id: "step-8",
            title_p: "Finalizing audit trail and archiving process record...",
            title_s: "Process complete — PR-2026-00847 auto-approved, audit trail archived",
            reasoning: [
                "Processing duration: 42 seconds (Stage 1 queue to Stage 7 approval)",
                "Systems accessed: SAP Ariba (queue, PR detail, approval action), Ferring Supplier Master",
                "14 validations run — all 14 passed (100%) | Aggregate confidence: 0.97",
                "0 HITL gates triggered — full automated approval, no human intervention required",
                "Supplier verified: Sigma-Aldrich Chemie GmbH (SUP-88421) — Active, EMEA, Net 30",
                "PR-2026-00847 status: Approved | Requester Elena Kowalski notified via SAP Ariba system",
                "All artifacts (PR header, line items, quotation extraction, validation summary, approval confirmation) archived",
                "Queue updated — next PR (PR-2026-00851) available for processing"
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
