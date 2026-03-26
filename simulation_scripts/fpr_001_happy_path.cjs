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
        {
                "id": "step-1",
                "title_p": "Desktop agent connecting to SAP Ariba...",
                "title_s": "Connected to SAP Ariba - authenticated successfully",
                "reasoning": [
                        "Agent logged in as pace.agent@ferring.com",
                        "Session established with SAP Ariba production instance",
                        "Authentication token valid for 8 hours"
                ],
                "artifacts": [
                        {
                                "id": "v-ariba-1",
                                "type": "video",
                                "label": "Desktop Agent: SAP Ariba Login",
                                "videoPath": "/data/sap_ariba_login_fpr001.webm"
                        }
                ]
        },
        {
                "id": "step-2",
                "title_p": "Retrieving pending Purchase Requisitions...",
                "title_s": "PR-2026-00847 retrieved from approval queue",
                "reasoning": [
                        "Queried pending approvals for user Zamp.ai_test",
                        "Found 6 pending PRs in queue",
                        "Selected PR-2026-00847 for processing (FIFO order)"
                ],
                "artifacts": [
                        {
                                "id": "pr-header-1",
                                "type": "json",
                                "label": "PR Header Data",
                                "data": {
                                        "pr_id": "PR-2026-00847",
                                        "company_code": "1000",
                                        "entity": "Ferring International Center SA",
                                        "requester": "Elena Kowalski",
                                        "budget_owner": "Dr. Marcus Weber",
                                        "po_owner": "Elena Kowalski",
                                        "currency": "CHF",
                                        "total_amount": "12,450.00",
                                        "line_items": 3,
                                        "region": "Switzerland"
                                }
                        }
                ]
        },
        {
                "id": "step-3",
                "title_p": "Extracting PR line items and supplier details...",
                "title_s": "3 line items extracted with supplier enrichment complete",
                "reasoning": [
                        "Line 1: Analytical Grade Reagents - CHF 4,200.00",
                        "Line 2: HPLC Columns (C18) - CHF 5,750.00",
                        "Line 3: Lab Consumables Kit - CHF 2,500.00",
                        "Supplier master lookup: Sigma-Aldrich found, ID SUP-88421",
                        "No purchasing or posting blocks detected"
                ]
        },
        {
                "id": "step-4",
                "title_p": "Downloading and validating attachments...",
                "title_s": "Validation 1/14: Attachment validated - Quotation identified (confidence: 0.95)",
                "reasoning": [
                        "Downloaded 1 attachment: Sigma_Aldrich_Q2026_0847.pdf (2 pages, 312KB)",
                        "Document type: Quotation (confidence score: 0.95)",
                        "File format valid (PDF)",
                        "All required fields detected in document"
                ],
                "artifacts": [
                        {
                                "id": "pdf-1",
                                "type": "file",
                                "label": "Quotation - Sigma-Aldrich",
                                "pdfPath": "/data/sigma_aldrich_quotation_q2026.pdf"
                        }
                ]
        },
        {
                "id": "step-5",
                "title_p": "Extracting structured data from quotation...",
                "title_s": "Structured data extracted - all fields populated",
                "reasoning": [
                        "Supplier: Sigma-Aldrich Chemie GmbH, Buchs, Switzerland",
                        "Total amount: CHF 12,450.00",
                        "Currency: CHF (ISO 4217 validated)",
                        "3 line items with descriptions, quantities, unit prices",
                        "Quote date: 2026-03-15, Valid until: 2026-06-15"
                ],
                "artifacts": [
                        {
                                "id": "extracted-1",
                                "type": "json",
                                "label": "Extracted Document Data",
                                "data": {
                                        "supplier_name": "Sigma-Aldrich Chemie GmbH",
                                        "supplier_address": "Industriestrasse 25, 9471 Buchs, Switzerland",
                                        "total_amount": "12,450.00",
                                        "currency": "CHF",
                                        "document_date": "2026-03-15",
                                        "valid_until": "2026-06-15",
                                        "line_items": [
                                                {
                                                        "description": "Analytical Grade Reagents",
                                                        "quantity": 10,
                                                        "unit_price": 420.0,
                                                        "total": 4200.0
                                                },
                                                {
                                                        "description": "HPLC Columns C18 250mm",
                                                        "quantity": 5,
                                                        "unit_price": 1150.0,
                                                        "total": 5750.0
                                                },
                                                {
                                                        "description": "Lab Consumables Kit",
                                                        "quantity": 5,
                                                        "unit_price": 500.0,
                                                        "total": 2500.0
                                                }
                                        ]
                                }
                        }
                ]
        },
        {
                "id": "step-6",
                "title_p": "Running comprehensive validation suite (14 domains)...",
                "title_s": "Validations 2-8 complete: Accounting, Budget Owner, Currency, Material Group, Supplier, Pricing, Service Type - all PASS",
                "reasoning": [
                        "V2 Accounting: Assignment K, Cost Center CC-RD-4521, GL 51200100 - consistent",
                        "V3 Budget Owner: Dr. Marcus Weber != Elena Kowalski - PASS",
                        "V4 Currency: CHF matches across document and all 3 PR line items",
                        "V5 Material Group: MG-LAB-001 linked to GL 51200100 in master",
                        "V6 Supplier: Sigma-Aldrich Chemie GmbH vs Sigma-Aldrich - 96% match - PASS",
                        "V7 Pricing: PR total CHF 12,450.00 = Document total CHF 12,450.00 - exact match",
                        "V8 Service Type: SAC code 998599 valid, strong match (0.91)"
                ]
        },
        {
                "id": "step-7",
                "title_p": "Completing validation suite (domains 9-14)...",
                "title_s": "Validations 9-14 complete: Ordering, Ship-To, Sold-To, Company Code, Quantity, Deliver-To - all PASS",
                "reasoning": [
                        "V9 Ordering: EMAIL method, sigma-aldrich@sial.com valid, domain matches",
                        "V10 Ship-To: SHIP-CH-001 valid, linked to company code 1000",
                        "V11 Sold-To: 1000 = 1000, entity name match confirmed",
                        "V12 Company Code: Ferring International Center SA - high confidence (0.97)",
                        "V13 Quantity: All 3 line items match at Level 1 (individual quantities)",
                        "V14 Deliver-To: Ferring R&D Lab, Building C, Saint-Prex - valid content"
                ]
        },
        {
                "id": "step-8",
                "title_p": "Generating validation summary...",
                "title_s": "Overall status: PASS - all 14/14 validations passed",
                "reasoning": [
                        "Total validations: 14",
                        "Passed: 14",
                        "Failed: 0",
                        "Manual Review: 0",
                        "Confidence: 1.0 across all domains",
                        "Recommendation: Auto-approve PR"
                ],
                "artifacts": [
                        {
                                "id": "val-summary-1",
                                "type": "json",
                                "label": "Validation Summary",
                                "data": {
                                        "overall_status": "PASS",
                                        "total_validations": 14,
                                        "passed": 14,
                                        "failed": 0,
                                        "manual_review": 0,
                                        "validation_results": {
                                                "attachment": "PASS",
                                                "accounting": "PASS",
                                                "budget_owner": "PASS",
                                                "currency": "PASS",
                                                "material_group": "PASS",
                                                "supplier_id": "PASS",
                                                "pricing": "PASS",
                                                "service_type": "PASS",
                                                "ordering_method": "PASS",
                                                "ship_to": "PASS",
                                                "sold_to": "PASS",
                                                "company_code": "PASS",
                                                "quantity": "PASS",
                                                "deliver_to": "PASS"
                                        }
                                }
                        }
                ]
        },
        {
                "id": "step-9",
                "title_p": "Approving PR in SAP Ariba...",
                "title_s": "PR-2026-00847 approved in SAP Ariba - comment posted",
                "reasoning": [
                        "Desktop agent returned to SAP Ariba PR-2026-00847",
                        "Selected 'Approve' action from approver actions menu",
                        "Posted approval comment: 'All 14 validation checks passed (100%). Quotation CHF 12,450.00 matches PR. Supplier Sigma-Aldrich (Merck) verified at 99% confidence.'",
                        "Status changed: Pending Approval → Approved",
                        "Approval confirmation received (200 OK)",
                        "No email required for full PASS status",
                        "Processing time: 38 seconds"
                ],
                "artifacts": [
                        {
                                "id": "v-ariba-approve-1",
                                "type": "video",
                                "label": "Desktop Agent: SAP Ariba Approval",
                                "videoPath": "/data/sap_ariba_login_fpr001.webm"
                        },
                        {
                                "id": "ariba-confirm-1",
                                "type": "json",
                                "label": "SAP Ariba Approval Confirmation",
                                "data": {
                                        "action": "APPROVED",
                                        "pr_id": "PR-2026-00847",
                                        "status_before": "Pending Approval",
                                        "status_after": "Approved",
                                        "approval_comment": "All 14 validation checks passed (100%). PR-2026-00847 auto-approved by Pace. Quotation total CHF 12,450.00 matches PR. Supplier Sigma-Aldrich (Merck) verified.",
                                        "timestamp": "2026-03-26T10:15:42Z",
                                        "comment_posted": true,
                                        "api_response": "200 OK",
                                        "approved_by": "Pace Automation Agent"
                                }
                        }
                ]
        },
        {
                "id": "step-10",
                "title_p": "Finalizing and logging audit trail...",
                "title_s": "Process complete - PR-2026-00847 auto-approved successfully",
                "reasoning": [
                        "Audit trail logged with full validation details",
                        "Processing duration: 42 seconds",
                        "All artifacts archived for compliance",
                        "Next PR will be fetched from queue"
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
            id: step.id, title: step.title_s,
            status: isFinal ? 'completed' : 'success',
            reasoning: step.reasoning || [], artifacts: step.artifacts || []
        });
        await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
        await delay(1500);
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();