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
        // STEP 1: SAP Ariba login
        {
            id: "step-1",
            title_p: "Desktop agent connecting to SAP Ariba...",
            title_s: "Connected to SAP Ariba — authenticated successfully",
            reasoning: [
                "Logged in as pace.agent@ferring.com",
                "Session established (SESS-2026-03-26-1108)",
                "Navigating to pending approvals queue"
            ]
        },
        // STEP 2: Retrieve PR
        {
            id: "step-2",
            title_p: "Retrieving PR-2026-01100 from approval queue...",
            title_s: "PR-2026-01100 retrieved — Lonza Group AG, CHF 98,500.00",
            reasoning: [
                "PR-2026-01100 located in pending approvals",
                "Read Company Code: 1000 (Ferring International Center SA)",
                "Read Requester: Dr. Nadia Petrov",
                "Read Budget Owner: Dr. Thomas Klein",
                "Read Supplier: Lonza Group AG (SUP-55301)",
                "Read Total Amount: CHF 98,500.00",
                "Read Cost Center: CC-API-CH-021"
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
                        supplier: "Lonza Group AG",
                        supplier_id: "SUP-55301",
                        currency: "CHF",
                        total_amount: "98,500.00",
                        cost_center: "CC-API-CH-021"
                    }
                }
            ]
        },
        // STEP 3: Extract line items
        {
            id: "step-3",
            title_p: "Extracting PR line items...",
            title_s: "2 line items extracted — CHF 98,500.00 confirmed",
            reasoning: [
                "Line 1: API Manufacturing Services — 1 batch × CHF 72,000.00",
                "Line 2: Analytical Method Transfer — 1 LOT × CHF 26,500.00",
                "Sum: CHF 72,000 + CHF 26,500 = CHF 98,500.00 — matches PR total ✓",
                "Both lines reference Material Group: MG-API-001"
            ],
            artifacts: [
                {
                    id: "line-items-4",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            { line: "1", description: "API Manufacturing Services", qty: "1 batch", unit_price: "CHF 72,000.00", total: "CHF 72,000.00" },
                            { line: "2", description: "Analytical Method Transfer", qty: "1 LOT", unit_price: "CHF 26,500.00", total: "CHF 26,500.00" }
                        ],
                        sum_check: "CHF 98,500.00 = PR total ✓"
                    }
                }
            ]
        },
        // STEP 4: Attachment search (NEW — explicit search with findings)
        {
            id: "step-4",
            title_p: "Searching all attachment sources for PR-2026-01100...",
            title_s: "Attachment search complete — FAIL: 0 attachments found across all sources",
            reasoning: [
                "Checked SAP Ariba PR-2026-01100 Attachments tab — 0 files",
                "Checked SAP Ariba PR-2026-01100 Notes & Attachments section — 0 files",
                "Checked requester email thread (rajesh queue) for forwarded documents — 0 relevant attachments",
                "Checked shared procurement inbox procurement-ch@ferring.com — no documents for PR-2026-01100",
                "Checked SAP Ariba purchase order history for prior transactions with Lonza SUP-55301 — no reusable documents",
                "RESULT: No supporting documents found. Validation 1/14: FAIL — attachment required per Ferring procurement policy"
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
                            { source: "Requester email thread", result: "0 relevant documents" },
                            { source: "procurement-ch@ferring.com inbox", result: "0 documents for this PR" },
                            { source: "Prior PO history with Lonza SUP-55301", result: "No reusable documents" }
                        ],
                        total_found: 0,
                        v1_attachment_result: "FAIL",
                        policy: "Ferring procurement policy requires at least 1 supporting document (invoice, quotation, or SOW) for PRs above CHF 10,000"
                    }
                }
            ]
        },
        // STEP 5: Triggered email notification
        {
            id: "step-5",
            title_p: "Sending notification email to requester — attachment required...",
            title_s: "Notification sent to Dr. Nadia Petrov — PR halted pending document upload",
            reasoning: [
                "Drafted email to: nadia.petrov@ferring.com",
                "CC: procurement-ch@ferring.com",
                "Subject: Action Required — Missing Attachment for PR-2026-01100",
                "Body explains: validation halted at step 1/14 because no supporting document was found",
                "Requests: quotation, invoice, or signed SOW from Lonza Group AG",
                "Email sent automatically (no HITL required for missing-document notification per policy)",
                "Processing suspended — PR moved to 'Needs Attention' queue"
            ],
            artifacts: [
                {
                    id: "notification-email-4",
                    type: "email_draft",
                    label: "Notification Email Sent",
                    data: {
                        isIncoming: false,
                        to: "nadia.petrov@ferring.com",
                        cc: "procurement-ch@ferring.com",
                        subject: "Action Required — Missing Attachment for PR-2026-01100",
                        body: "Dear Dr. Petrov,\n\nPurchase Requisition PR-2026-01100 (Lonza Group AG, CHF 98,500.00) has been received but cannot proceed through automated validation because no supporting document is attached.\n\nFerring procurement policy requires at least one supporting document (invoice, quotation, or signed SOW) for PRs above CHF 10,000.\n\nOur search covered:\n- SAP Ariba attachments (0 found)\n- Notes & Attachments section (0 found)\n- Your email thread history (0 relevant documents)\n- procurement-ch@ferring.com shared inbox (0 documents)\n\nAction required: Please attach the relevant document (quotation, invoice, or SOW from Lonza Group AG) to PR-2026-01100 in SAP Ariba. Validation will resume automatically once an attachment is detected.\n\nBest regards,\nFerring Procurement Automation (Pace)\nprocurement-ch@ferring.com"
                    }
                }
            ]
        },
        // STEP 6: Update Supplier Master with missing attachment flag
        {
            id: "step-6",
            title_p: "Updating Ferring Supplier Master — logging missing attachment alert for Lonza...",
            title_s: "Supplier Master updated — Lonza Group AG: missing attachment flag added, follow-up scheduled",
            reasoning: [
                "Opened Ferring Supplier Master portal",
                "Located supplier record for Lonza Group AG",
                "Added process flag: Missing Supporting Documentation",
                "Added note: \"PR-2026-01100 — CHF 340,000. No supporting documents found across 5 sources (Ariba attachments, email thread, shared inbox, PO history, vendor portal). Requester notified.\"",
                "Follow-up date set: 3 business days",
                "Alert sent to procurement team: missing-docs@ferring.com"
            ]
        },
        // STEP 7: Audit trail
        {
            id: "step-7",
            title_p: "Logging audit trail — PR halted at validation step 1/14...",
            title_s: "Process halted — PR-2026-01100 requires attachment before validation can continue",
            reasoning: [
                "Duration: 28 seconds",
                "Validation stopped at V1 (attachment check) — all 5 sources searched, 0 documents found",
                "Notification email sent to requester and procurement inbox",
                "PR status: Needs Attention — monitoring for attachment upload",
                "Validation will auto-resume when attachment detected"
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
