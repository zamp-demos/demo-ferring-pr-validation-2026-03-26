const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_004";
const CASE_NAME = "No Attachments PR";

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
                        "Session established successfully"
                ]
        },
        {
                "id": "step-2",
                "title_p": "Retrieving PR-2026-01100 from approval queue...",
                "title_s": "PR-2026-01100 retrieved - Lonza Group AG",
                "reasoning": [
                        "PR fetched from pending approvals queue",
                        "Company code: 1000 (Ferring International Center SA)",
                        "Requester: Dr. Sarah Chen",
                        "Amount: CHF 340,000.00",
                        "Material: Biopharmaceutical raw materials"
                ],
                "artifacts": [
                        {
                                "id": "pr-header-4",
                                "type": "json",
                                "label": "PR Header Data",
                                "data": {
                                        "pr_id": "PR-2026-01100",
                                        "company_code": "1000",
                                        "entity": "Ferring International Center SA",
                                        "requester": "Dr. Sarah Chen",
                                        "supplier": "Lonza Group AG",
                                        "currency": "CHF",
                                        "total_amount": "340,000.00",
                                        "line_items": 2
                                }
                        }
                ]
        },
        {
                "id": "step-3",
                "title_p": "Extracting PR line items...",
                "title_s": "2 line items extracted - supplier enrichment complete",
                "reasoning": [
                        "Line 1: CHO Cell Culture Media (500L) - CHF 195,000.00",
                        "Line 2: Downstream Processing Resins - CHF 145,000.00",
                        "Supplier: Lonza Group AG (ID: SUP-92103)",
                        "No blocks detected, payment terms: NET 45"
                ],
                "artifacts": [
                        {
                                "id": "items-4",
                                "type": "json",
                                "label": "PR Line Items",
                                "data": {
                                        "line_items": [
                                                {
                                                        "item": 1,
                                                        "description": "CHO Cell Culture Media 500L",
                                                        "quantity": 10,
                                                        "unit_price": 19500.0,
                                                        "total": 195000.0,
                                                        "material_group": "MG-BIO-003"
                                                },
                                                {
                                                        "item": 2,
                                                        "description": "Downstream Processing Resins",
                                                        "quantity": 5,
                                                        "unit_price": 29000.0,
                                                        "total": 145000.0,
                                                        "material_group": "MG-BIO-005"
                                                }
                                        ],
                                        "supplier_enrichment": {
                                                "supplier_id": "SUP-92103",
                                                "name": "Lonza Group AG",
                                                "address": "Muenchensteinerstrasse 38, 4002 Basel, Switzerland",
                                                "email": "orders@lonza.com",
                                                "payment_terms": "NET 45"
                                        }
                                }
                        }
                ]
        },
        {
                "id": "step-4",
                "title_p": "Checking for attachments...",
                "title_s": "No attachments found on PR-2026-01100",
                "reasoning": [
                        "Attachment count: 0",
                        "No documents available for validation",
                        "Cannot proceed with document-based validations (Validations 1-14)",
                        "PR requires attention - supporting documents must be attached"
                ]
        },
        {
                "id": "step-5",
                "title_p": "Routing to Needs Attention queue...",
                "title_s": "PR moved to Needs Attention - awaiting document upload",
                "reasoning": [
                        "PR-2026-01100 flagged: missing attachments",
                        "Requester Dr. Sarah Chen will be notified",
                        "Supporting documents required: Quotation, SOW, or MSA from Lonza Group AG",
                        "PR cannot be approved or rejected without document validation"
                ]
        },
        {
                "id": "step-6",
                "title_p": "Logging audit trail...",
                "title_s": "Process complete - PR requires manual attention for missing documents",
                "reasoning": [
                        "Audit trail logged: PR processed but requires attachments",
                        "Status: Needs Review",
                        "Processing time: 18 seconds",
                        "Agent will move to next PR in queue"
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
        await updateProcessListStatus(PROCESS_ID, isFinal ? 'Needs Review' : 'In Progress', step.title_s);
        await delay(1500);
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();