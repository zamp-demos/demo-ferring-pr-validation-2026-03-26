const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_004";
const CASE_NAME = "No Attachments PR Halt";

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
            title_s: "SAP Ariba queue: 4 pending PRs found — selected PR-2026-01100 (FIFO)",
            reasoning: [
                "Agent accessed SAP Ariba production instance as pace.agent@ferring.com",
                "Queried pending approvals queue for Zamp.ai_test approval group",
                "Found 4 pending PRs in queue (FIFO ordering applied)",
                "PR-2026-01100 selected — oldest unprocessed PR, Lonza Group AG, CHF 340,000.00",
                "Other PRs in queue: PR-2026-01103, PR-2026-01107, PR-2026-01112 (deferred)",
                "Queue position recorded — processing PR-2026-01100 now"
            ]
        },
        // STAGE 2: Authentication and PR Retrieval
        {
            id: "step-2",
            title_p: "Authenticating to SAP Ariba and retrieving PR details...",
            title_s: "Connected to SAP Ariba — PR-2026-01100 opened, Lonza Group AG, CHF 340,000.00",
            reasoning: [
                "Authenticated as pace.agent@ferring.com — session token valid",
                "Navigated to PR-2026-01100 detail view",
                "Opened PR header: Company Code 1000, Ferring International Center SA",
                "Requester: Dr. Nadia Petrov | Budget Owner: Dr. Thomas Klein | PO Owner: Dr. Nadia Petrov",
                "Cost Center: CC-API-CH-021 | Currency: CHF | Total Amount: CHF 340,000.00",
                "Supplier: Lonza Group AG (SUP-55301) | Region: Switzerland (EMEA)",
                "PR status: Pending Approval"
            ],
            artifacts: [
                {
                    id: "pr-header-4",
                    type: "json",
                    label: "PR-2026-01100 Header Data",
                    data: {
                        pr_id: "PR-2026-01100",
                        company_code: "1000",
                        entity: "Ferring International Center SA",
                        requester: "Dr. Nadia Petrov",
                        budget_owner: "Dr. Thomas Klein",
                        po_owner: "Dr. Nadia Petrov",
                        cost_center: "CC-API-CH-021",
                        currency: "CHF",
                        total_amount: "340,000.00",
                        supplier: "Lonza Group AG",
                        supplier_id: "SUP-55301",
                        region: "Switzerland (EMEA)",
                        line_items: 2
                    }
                }
            ]
        },
        // STAGE 3: Data Extraction
        {
            id: "step-3",
            title_p: "Extracting PR data — header fields, line items, and supplier enrichment...",
            title_s: "2 line items extracted — CHF 340,000.00 total, supplier enriched via Supplier Master",
            reasoning: [
                "Clicked 'Line Items' tab in PR-2026-01100 detail view",
                "Line 1: API Manufacturing Services — 1 batch × CHF 265,000.00 = CHF 265,000.00",
                "Line 2: Analytical Method Transfer — 1 LOT × CHF 75,000.00 = CHF 75,000.00",
                "Sum check: CHF 265,000 + CHF 75,000 = CHF 340,000.00 — matches PR header total ✓",
                "Both lines reference Material Group: MG-API-001",
                "--- Supplier Master Enrichment ---",
                "Looked up SUP-55301 in Ferring Supplier Master database",
                "Retrieved: Lonza Group AG | Address: Muenchensteinerstrasse 38, 4002 Basel, Switzerland",
                "Contact email: procurement@lonza.com | Payment terms: Net 45 | Ordering method: EMAIL",
                "Supplier status: Active — no purchasing blocks, no compliance flags",
                "Registration date: 2012-04-15 | Region: EMEA | Entity type: Strategic Supplier",
                "Supplier enrichment complete"
            ],
            artifacts: [
                {
                    id: "line-items-4",
                    type: "json",
                    label: "PR Line Items + Supplier Enrichment",
                    data: {
                        line_items: [
                            { line: "1", description: "API Manufacturing Services", qty: "1 batch", unit_price: "CHF 265,000.00", total: "CHF 265,000.00" },
                            { line: "2", description: "Analytical Method Transfer", qty: "1 LOT", unit_price: "CHF 75,000.00", total: "CHF 75,000.00" }
                        ],
                        sum_check: "CHF 340,000.00 = PR total ✓",
                        supplier_master: {
                            supplier_id: "SUP-55301",
                            name: "Lonza Group AG",
                            address: "Muenchensteinerstrasse 38, 4002 Basel, Switzerland",
                            email: "procurement@lonza.com",
                            payment_terms: "Net 45",
                            ordering_method: "EMAIL",
                            status: "Active",
                            region: "EMEA"
                        }
                    }
                }
            ]
        },
        // STAGE 4: Attachment Check — FAIL, process halts
        {
            id: "step-4",
            title_p: "Checking attachments tab — downloading and classifying documents...",
            title_s: "Validation 1/14: FAIL — 0 attachments found across all sources",
            reasoning: [
                "Clicked 'Attachments' tab in PR-2026-01100 detail view — 0 files found",
                "Checked 'Notes & Attachments' section in PR detail — 0 files found",
                "Searched requester email thread (Dr. Nadia Petrov) for forwarded documents — 0 relevant attachments",
                "Checked shared procurement inbox procurement-ch@ferring.com — no documents linked to PR-2026-01100",
                "Checked SAP Ariba PO history for prior transactions with Lonza SUP-55301 — no reusable documents",
                "RESULT: 0 attachments found across all 5 sources",
                "Ferring procurement policy: at least 1 supporting document required for PRs above CHF 10,000",
                "V1 Attachment Check: FAIL — process halted, remaining 13 validations cannot proceed",
                "Notification queued to requester Dr. Nadia Petrov"
            ],
            artifacts: [
                {
                    id: "attachment-search-4",
                    type: "json",
                    label: "Attachment Search Results",
                    data: {
                        sources_checked: [
                            { source: "SAP Ariba Attachments tab", result: "0 files" },
                            { source: "SAP Ariba Notes & Attachments section", result: "0 files" },
                            { source: "Requester email thread (Dr. Nadia Petrov)", result: "0 relevant documents" },
                            { source: "procurement-ch@ferring.com shared inbox", result: "0 documents for PR-2026-01100" },
                            { source: "Prior PO history with Lonza SUP-55301", result: "No reusable documents" }
                        ],
                        total_found: 0,
                        v1_attachment_result: "FAIL",
                        validations_blocked: 13,
                        policy: "Ferring procurement policy requires at least 1 supporting document (invoice, quotation, or SOW) for PRs above CHF 10,000"
                    }
                }
            ]
        },
        // Halt: Notification to requester
        {
            id: "step-5",
            title_p: "Sending notification to requester — missing attachment, process halted...",
            title_s: "Notification sent to Dr. Nadia Petrov — PR-2026-01100 halted pending attachment upload",
            reasoning: [
                "Process halted at Stage 4 (Validation 1/14) — no supporting documents found",
                "Drafted notification email to: nadia.petrov@ferring.com",
                "CC: thomas.klein@ferring.com (Budget Owner), procurement-ch@ferring.com",
                "Subject: Action Required — Missing Attachment for PR-2026-01100 (Lonza Group AG, CHF 340,000.00)",
                "Email body: explains validation halted at V1/14, lists all 5 sources checked, requests quotation / invoice / signed SOW from Lonza Group AG",
                "Requester instructed to attach document to PR-2026-01100 in SAP Ariba — validation will auto-resume on detection",
                "Notification sent successfully — no HITL required for missing-document alerts per Ferring policy",
                "PR-2026-01100 status set to: Needs Review — monitoring for attachment upload"
            ],
            artifacts: [
                {
                    id: "notification-email-4",
                    type: "email_draft",
                    label: "Notification Email — Missing Attachment",
                    data: {
                        isIncoming: false,
                        to: "nadia.petrov@ferring.com",
                        cc: "thomas.klein@ferring.com, procurement-ch@ferring.com",
                        subject: "Action Required — Missing Attachment for PR-2026-01100 (Lonza Group AG, CHF 340,000.00)",
                        body: "Dear Dr. Petrov,\n\nPurchase Requisition PR-2026-01100 (Lonza Group AG, CHF 340,000.00) has been received but cannot proceed through automated validation because no supporting document is attached.\n\nFerring procurement policy requires at least one supporting document (invoice, quotation, or signed SOW) for PRs above CHF 10,000.\n\nOur search covered all available sources:\n- SAP Ariba Attachments tab (0 files)\n- SAP Ariba Notes & Attachments section (0 files)\n- Your email thread history (0 relevant documents)\n- procurement-ch@ferring.com shared inbox (0 documents)\n- Prior PO history with Lonza Group AG SUP-55301 (no reusable documents)\n\nAction required: Please attach the relevant document (quotation, invoice, or signed SOW from Lonza Group AG) to PR-2026-01100 in SAP Ariba. Automated validation will resume once an attachment is detected.\n\nBest regards,\nFerring Procurement Automation (Pace)\nprocurement-ch@ferring.com"
                    }
                }
            ]
        },
        // STAGE 9 (abbreviated): Audit trail for halted process
        {
            id: "step-6",
            title_p: "Logging audit trail — process halted at Validation 1/14...",
            title_s: "Process halted — PR-2026-01100 requires attachment before validation can continue",
            reasoning: [
                "Processing duration: 28 seconds (Stage 1 queue to Stage 4 attachment halt)",
                "Systems accessed: SAP Ariba (queue, PR detail, attachments), Ferring Supplier Master",
                "Validation stopped at V1 (attachment check) — 0 documents found across 5 sources",
                "13 remaining validations blocked pending document upload",
                "Notification sent to Dr. Nadia Petrov (requester) and Dr. Thomas Klein (budget owner)",
                "PR-2026-01100 status: Needs Review — awaiting attachment",
                "Automated monitoring active — validation will resume on attachment detection in SAP Ariba"
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
        await updateProcessListStatus(PROCESS_ID, isFinal ? 'Needs Review' : 'In Progress', step.title_s);
        await delay(1500);
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
