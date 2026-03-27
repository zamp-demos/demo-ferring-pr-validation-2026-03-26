const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_004";
const CASE_NAME = "Missing Attachments";

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

    // ── STAGE 1: SAP Ariba Queue + Data Extraction ────────────────────────────────
    // Step 1 — Queue access
    const step1 = {
        id: "step-1",
        title_p: "Accessing SAP Ariba pending approvals queue...",
        title_s: "SAP Ariba queue: 4 pending PRs found — selected PR-2026-01100 (FIFO)",
        reasoning: [
            "Agent accessed SAP Ariba production instance as pace.agent@ferring.com",
            "Queried pending approvals queue for Zamp.ai_test approval group",
            "Found 4 pending PRs in queue (FIFO ordering applied)",
            "PR-2026-01100 selected — oldest unprocessed PR, Lonza Group AG, CHF 340,000.00",
            "Other PRs in queue: PR-2026-01103, PR-2026-01107, PR-2026-01112 (deferred)",
            "Double-clicked PR-2026-01100 to open detail view — PR status: Pending Approval",
            "Queue position recorded — processing PR-2026-01100 now"
        ],
        artifacts: [
            {
                id: "v-ariba-queue-4",
                type: "video",
                label: "SAP Ariba: Queue View + PR-2026-01100 Detail (Empty Attachments Tab)",
                videoPath: "/data/sap_ariba_queue_fpr004.webm"
            }
        ]
    };

    updateProcessLog(PROCESS_ID, {
        id: step1.id,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: step1.title_p,
        status: 'processing'
    });
    await updateProcessListStatus(PROCESS_ID, 'In Progress', step1.title_p);
    await delay(2000);

    updateProcessLog(PROCESS_ID, {
        id: step1.id,
        title: step1.title_s,
        status: 'success',
        reasoning: step1.reasoning,
        artifacts: step1.artifacts
    });
    await updateProcessListStatus(PROCESS_ID, 'In Progress', step1.title_s);
    await delay(1500);

    // Step 2 — PR header + line item extraction
    const step2 = {
        id: "step-2",
        title_p: "Extracting PR header and line items from SAP Ariba...",
        title_s: "PR-2026-01100 extracted — 2 line items, CHF 340,000.00, Lonza Group AG confirmed in Supplier Master",
        reasoning: [
            "Authenticated as pace.agent@ferring.com — session token valid (SESS-2026-03-26-0401)",
            "PR Header extracted: PR ID PR-2026-01100, Company Code 1000 (Ferring International Center SA)",
            "Requester: Dr. Nadia Petrov | Budget Owner: Dr. Thomas Klein | PO Owner: Dr. Nadia Petrov",
            "Cost Center: CC-API-CH-021 | Currency: CHF | Total Amount: CHF 340,000.00",
            "Preferred Ordering Method: EMAIL | Supplier: Lonza Group AG (SUP-55301) | Region: Switzerland (EMEA)",
            "Line Items tab opened — 2 line items found:",
            "Line 1: GMP API Manufacturing Services — 1 batch × CHF 265,000.00 = CHF 265,000.00 | MG-API-001 | GL 51300100",
            "Line 2: Analytical Method Transfer & Validation — 1 LOT × CHF 75,000.00 = CHF 75,000.00 | MG-API-001 | GL 51300100",
            "Sum check: CHF 265,000 + CHF 75,000 = CHF 340,000.00 — matches PR header ✓",
            "Ship-To: SHIP-CH-001 | Sold-To: 1000 | Account Type: K | WBS: WBS-API-2026-007",
            "Supplier Master lookup initiated for SUP-55301..."
        ],
        artifacts: [
            {
                id: "pr-header-4",
                type: "json",
                label: "PR Header Data",
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
                    preferred_ordering_method: "EMAIL",
                    region: "Switzerland (EMEA)",
                    ship_to: "SHIP-CH-001",
                    sold_to: "1000",
                    account_type: "K",
                    wbs: "WBS-API-2026-007",
                    pr_date: "2026-03-24",
                    status: "Pending Approval"
                }
            },
            {
                id: "line-items-4",
                type: "json",
                label: "PR Line Items",
                data: {
                    line_items: [
                        {
                            line: "1", description: "GMP API Manufacturing Services",
                            qty: "1 batch", unit_price: "CHF 265,000.00", total: "CHF 265,000.00",
                            material_group: "MG-API-001", gl_account: "51300100",
                            account_type: "K", cost_center: "CC-API-CH-021",
                            wbs: "WBS-API-2026-007", deliver_to: "Ferring Manufacturing, Cheligny, France"
                        },
                        {
                            line: "2", description: "Analytical Method Transfer & Validation",
                            qty: "1 LOT", unit_price: "CHF 75,000.00", total: "CHF 75,000.00",
                            material_group: "MG-API-001", gl_account: "51300100",
                            account_type: "K", cost_center: "CC-API-CH-021",
                            wbs: "WBS-API-2026-007", deliver_to: "Ferring Manufacturing, Cheligny, France"
                        }
                    ],
                    sum_check: "CHF 340,000.00 = PR header total ✓",
                    supplier_master: {
                        supplier_id: "SUP-55301",
                        name: "Lonza Group AG",
                        address: "Muenchensteinerstrasse 38, 4002 Basel, Switzerland",
                        email: "procurement@lonza.com",
                        payment_terms: "Net 45",
                        ordering_method: "EMAIL",
                        status: "Active",
                        region: "EMEA",
                        entity_type: "Strategic Supplier"
                    }
                }
            }
        ]
    };

    updateProcessLog(PROCESS_ID, {
        id: step2.id,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: step2.title_p,
        status: 'processing'
    });
    await updateProcessListStatus(PROCESS_ID, 'In Progress', step2.title_p);
    await delay(2000);

    updateProcessLog(PROCESS_ID, {
        id: step2.id,
        title: step2.title_s,
        status: 'success',
        reasoning: step2.reasoning,
        artifacts: step2.artifacts
    });
    await updateProcessListStatus(PROCESS_ID, 'In Progress', step2.title_s);
    await delay(1500);

    // Step 3 — Attachment check: 0 found → HALT (action-needed)
    const step3 = {
        id: "step-3",
        title_p: "Checking attachments tab — downloading and classifying documents...",
        title_s: "V1 Attachment Check: FAIL — 0 attachments found across all sources. Process halted. Requester notified.",
        reasoning: [
            "Clicked 'Attachments' tab in PR-2026-01100 detail view — 0 files found",
            "Checked 'Notes & Attachments' section in PR detail view — 0 files found",
            "Searched requester email thread (Dr. Nadia Petrov, nadia.petrov@ferring.com) for forwarded documents — 0 relevant attachments",
            "Checked shared procurement inbox procurement-ch@ferring.com — no documents linked to PR-2026-01100",
            "Checked SAP Ariba PO history for prior transactions with Lonza SUP-55301 — no reusable supporting documents",
            "RESULT: 0 attachments found across all 5 sources",
            "Ferring procurement policy: at least 1 supporting document (quotation, invoice, or signed SOW) required for PRs above CHF 10,000",
            "PR-2026-01100 value: CHF 340,000.00 — far exceeds threshold; policy applies",
            "V1 Attachment Check: FAIL — 13 remaining validations cannot proceed without supporting documentation",
            "Drafted notification email to Dr. Nadia Petrov requesting attachment upload",
            "Notification sent automatically — no HITL required for missing-document alerts per Ferring policy",
            "PR-2026-01100 status set to: Needs Attention — awaiting attachment upload from requester"
        ],
        artifacts: [
            {
                id: "attachment-search-4",
                type: "json",
                label: "Attachment Search Results — All Sources",
                data: {
                    sources_checked: [
                        { source: "SAP Ariba Attachments tab", result: "0 files" },
                        { source: "SAP Ariba Notes & Attachments section", result: "0 files" },
                        { source: "Requester email thread (Dr. Nadia Petrov)", result: "0 relevant documents" },
                        { source: "procurement-ch@ferring.com shared inbox", result: "0 documents for PR-2026-01100" },
                        { source: "Prior PO history with Lonza SUP-55301", result: "No reusable supporting documents" }
                    ],
                    total_found: 0,
                    v1_attachment_result: "FAIL",
                    validations_blocked: 13,
                    pr_value: "CHF 340,000.00",
                    policy_threshold: "CHF 10,000.00",
                    policy: "Ferring procurement policy requires at least 1 supporting document (quotation, invoice, or signed SOW) for PRs above CHF 10,000",
                    action_taken: "Notification sent to Dr. Nadia Petrov — process halted pending attachment upload"
                }
            },
            {
                id: "notification-email-4",
                type: "email_draft",
                label: "Notification Email — Missing Attachment (Sent to Dr. Petrov)",
                data: {
                    isIncoming: false,
                    to: "nadia.petrov@ferring.com",
                    cc: "thomas.klein@ferring.com, procurement-ch@ferring.com",
                    subject: "Action Required — Missing Attachment for PR-2026-01100 (Lonza Group AG, CHF 340,000.00)",
                    body: "Dear Dr. Petrov,\n\nPurchase Requisition PR-2026-01100 (Lonza Group AG, CHF 340,000.00) has been received in the automated procurement queue but cannot proceed through validation because no supporting document is attached.\n\nFerring procurement policy requires at least one supporting document — such as a quotation, signed Statement of Work (SOW), or invoice — for all PRs above CHF 10,000.\n\nOur search covered all available sources:\n  - SAP Ariba Attachments tab: 0 files\n  - SAP Ariba Notes & Attachments section: 0 files\n  - Your email thread history: 0 relevant documents found\n  - procurement-ch@ferring.com shared inbox: 0 documents linked to PR-2026-01100\n  - Prior PO history with Lonza Group AG (SUP-55301): no reusable supporting documents\n\nAction Required:\nPlease attach the relevant document (quotation, invoice, or signed SOW from Lonza Group AG) directly to PR-2026-01100 in SAP Ariba.\n\nOnce an attachment is detected, automated validation will resume from the beginning. No further action is required on your part beyond uploading the document.\n\nIf you believe a document was already submitted, please forward it to procurement-ch@ferring.com referencing PR-2026-01100 and we will re-run the attachment check.\n\nBest regards,\nFerring Procurement Automation (Pace)\nprocurement-ch@ferring.com"
                }
            }
        ]
    };

    updateProcessLog(PROCESS_ID, {
        id: step3.id,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: step3.title_p,
        status: 'processing'
    });
    await updateProcessListStatus(PROCESS_ID, 'In Progress', step3.title_p);
    await delay(2000);

    // Final step — set action-needed, process status Needs Attention
    updateProcessLog(PROCESS_ID, {
        id: step3.id,
        title: step3.title_s,
        status: 'action-needed',
        reasoning: step3.reasoning,
        artifacts: step3.artifacts
    });
    await updateProcessListStatus(PROCESS_ID, 'Needs Attention', 'Needs Attention — Missing Attachment: PR-2026-01100 halted pending document upload');

    console.log(`${PROCESS_ID} Halted: ${CASE_NAME} — 0 attachments found, requester notified`);
})();
