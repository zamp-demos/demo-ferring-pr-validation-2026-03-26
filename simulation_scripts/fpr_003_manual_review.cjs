const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_003";
const CASE_NAME = "Manual Review Required";

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

const waitForSignal = async (signalId) => {
    console.log(`FPR_003: Waiting for human signal: ${signalId}...`);
    const signalFile = path.join(__dirname, '../interaction-signals.json');
    while (true) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (content) {
                    const signals = JSON.parse(content);
                    if (signals[signalId]) {
                        console.log(`FPR_003: Signal ${signalId} received!`);
                        delete signals[signalId];
                        const tmp = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                        fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
                        fs.renameSync(tmp, signalFile);
                        return true;
                    }
                }
            }
        } catch (e) { }
        await delay(1000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    const steps = [
        // STEP 1: SAP Ariba + PR retrieval
        {
            id: "step-1",
            title_p: "Connecting to SAP Ariba and retrieving PR-2026-01045...",
            title_s: "PR-2026-01045 retrieved — Catalent Pharma Solutions, EUR 185,000",
            reasoning: [
                "Authenticated to SAP Ariba as pace.agent@ferring.com",
                "PR-2026-01045 found in pending approvals queue",
                "Read Company Code: 3200 (Ferring GmbH, Kiel, Germany)",
                "Read Requester: Dr. Lena Fischer",
                "Read Budget Owner: Prof. Wilhelm Braun",
                "Read Supplier: Catalent Pharma Solutions (Supplier ID: SUP-61108)",
                "Read Total Amount: EUR 185,000.00",
                "Read Cost Center: CC-CLIN-DE-014"
            ]
        },
        // STEP 2: Download + classify attachment
        {
            id: "step-2",
            title_p: "Downloading and classifying attachment...",
            title_s: "Validation 1/14: SOW identified (confidence: 0.88) — downloaded",
            reasoning: [
                "Found 1 attachment: Catalent_SOW_Packaging_2026.pdf (8 pages, 445KB)",
                "Document type: Statement of Work (confidence: 0.88)",
                "Service description: Clinical Trial Supply & Packaging",
                "Contract term: 2026-04-01 through 2027-03-31 (12 months)"
            ],
            artifacts: [
                {
                    id: "pdf-3",
                    type: "file",
                    label: "SOW — Catalent Pharma Solutions",
                    pdfPath: "/data/catalent_sow_packaging_2026.pdf"
                }
            ]
        },
        // STEP 3: Extract SOW data
        {
            id: "step-3",
            title_p: "Extracting structured data from SOW...",
            title_s: "Data extracted — service descriptions mapped, EUR 185,000 confirmed",
            reasoning: [
                "Extracted Supplier: Catalent Pharma Solutions Inc.",
                "Extracted Service: Clinical Trial Supply & Packaging",
                "Extracted Total: EUR 185,000.00 — matches PR ✓",
                "Extracted 3 work packages: (1) Packaging EUR 85,000, (2) Labelling EUR 65,000, (3) Distribution EUR 35,000",
                "Contract term: 12 months from 2026-04-01"
            ]
        },
        // STEP 4: Supplier Master check (NEW)
        {
            id: "step-4",
            title_p: "Verifying Catalent Pharma Solutions against Ferring Supplier Master...",
            title_s: "Supplier Master: Catalent Pharma Solutions (SUP-61108) — Active, name match 95% — PASS",
            reasoning: [
                "Opened Ferring Supplier Master portal",
                "Searched 'Catalent' — found SUP-61108: Catalent Pharma Solutions (Active, Global)",
                "PR supplier name: 'Catalent Pharma Solutions'",
                "SOW supplier name: 'Catalent Pharma Solutions Inc.'",
                "Name match score: 95% (short form vs full legal name — acceptable threshold)",
                "No purchasing blocks or compliance flags on SUP-61108",
                "V6 Supplier: PASS (95% match exceeds 90% threshold)"
            ],
            artifacts: [
                {
                    id: "supplier-master-3",
                    type: "json",
                    label: "Supplier Master — Catalent",
                    data: {
                        supplier_id: "SUP-61108",
                        name: "Catalent Pharma Solutions",
                        full_legal_name: "Catalent Pharma Solutions Inc.",
                        status: "Active",
                        region: "Global",
                        match_score: "95%",
                        v6_result: "PASS"
                    }
                }
            ]
        },
        // STEP 5: Validation V2-V8
        {
            id: "step-5",
            title_p: "Running validation suite (domains 2-8)...",
            title_s: "Validations 2-7 PASS — V8 Service Type MANUAL_REVIEW (match score: 0.62)",
            reasoning: [
                "V2 Accounting: CC-CLIN-DE-014, GL 67100200 — consistent ✓ PASS",
                "V3 Budget Owner: Prof. Braun ≠ Dr. Fischer — segregation confirmed ✓ PASS",
                "V4 Currency: EUR matches throughout ✓ PASS",
                "V5 Material Group: MG-PKG-001 found in GL Exception List ✓ PASS",
                "V6 Supplier: Catalent Pharma Solutions — 95% match SUP-61108 ✓ PASS",
                "V7 Pricing: EUR 185,000 = EUR 185,000 exact match ✓ PASS",
                "V8 Service Type: 'Clinical Trial Supply & Packaging' vs 'Pharmaceutical Packaging Services' — score 0.62 — MANUAL_REVIEW (below 0.75 auto-pass threshold)"
            ],
            artifacts: [
                {
                    id: "svc-val-3",
                    type: "json",
                    label: "Service Type Validation Detail",
                    data: {
                        document_service_type: "Clinical Trial Supply & Packaging",
                        pr_description: "Pharmaceutical Packaging Services",
                        match_score: 0.62,
                        auto_pass_threshold: 0.75,
                        status: "MANUAL_REVIEW",
                        note: "Both refer to pharmaceutical packaging but different terminology — human confirmation needed"
                    }
                }
            ]
        },
        // STEP 6: Validation V9-V14
        {
            id: "step-6",
            title_p: "Completing validations 9-14...",
            title_s: "V9-V11 PASS — V12 Company Code MANUAL_REVIEW (0.78) — V13-V14 PASS",
            reasoning: [
                "V9 Ordering: EMAIL, catalent-orders@catalent.com valid ✓ PASS",
                "V10 Ship-To: SHIP-DE-001 valid for company code 3200 ✓ PASS",
                "V11 Sold-To: 3200 = 3200 ✓ PASS",
                "V12 Company Code: Document says 'Ferring Gesellschaft mit beschraenkter Haftung' vs master 'Ferring GmbH' — confidence 0.78 — MANUAL_REVIEW",
                "V13 Quantity: Line items match at Level 2 (sum) ✓ PASS",
                "V14 Deliver-To: Ferring GmbH, Wittland 11, 24109 Kiel — valid ✓ PASS"
            ],
            artifacts: [
                {
                    id: "cc-val-3",
                    type: "json",
                    label: "Company Code Validation",
                    data: {
                        document_company: "Ferring Gesellschaft mit beschraenkter Haftung",
                        master_entity: "Ferring GmbH",
                        confidence: 0.78,
                        status: "MANUAL_REVIEW",
                        note: "German full legal name vs abbreviated form — likely same entity, human confirmation needed"
                    }
                }
            ]
        },
        // STEP 7: Manual review decision gate
        {
            id: "step-7",
            title_p: "Overall status: MANUAL_REVIEW — 2 items require human decision",
            title_s: "2 validations require human confirmation — awaiting reviewer decision",
            reasoning: [
                "Issue 1: V8 Service Type — 'Clinical Trial Supply & Packaging' vs 'Pharmaceutical Packaging Services' (score 0.62)",
                "Issue 2: V12 Company Code — German full legal name vs abbreviated form (confidence 0.78)",
                "12 of 14 validations passed automatically",
                "Reviewer confirmation needed: (1) service descriptions are compatible, (2) German entity name variants match"
            ],
            artifacts: [
                {
                    id: "val-sum-3",
                    type: "json",
                    label: "Validation Summary",
                    data: {
                        overall_status: "MANUAL_REVIEW",
                        passed: 12, failed: 0, manual_review: 2,
                        items_for_review: [
                            "V8 Service Type: match 0.62 — confirm 'Clinical Trial Supply & Packaging' = 'Pharmaceutical Packaging Services'",
                            "V12 Company Code: confidence 0.78 — confirm 'Ferring Gesellschaft mit beschraenkter Haftung' = 'Ferring GmbH'"
                        ]
                    }
                }
            ]
        },
        // STEP 8: After human approval
        {
            id: "step-8",
            title_p: "Manual review decision received — updating status...",
            title_s: "Manual review approved — both items confirmed by reviewer, proceeding to SAP Ariba approval",
            reasoning: [
                "Reviewer confirmed: 'Clinical Trial Supply & Packaging' is consistent with 'Pharmaceutical Packaging Services' ✓",
                "Reviewer confirmed: German legal name variant matches Ferring GmbH entity ✓",
                "MANUAL_REVIEW overridden to PASS for both V8 and V12",
                "Overall status elevated to PASS — approval can proceed"
            ]
        },
        // STEP 9: Update Supplier Master with manual review log
        {
            id: "step-9",
            title_p: "Updating Ferring Supplier Master — logging manual review for Catalent...",
            title_s: "Supplier Master updated — SUP-61108 (Catalent): manual review initiated, EUR 185,000 flagged",
            reasoning: [
                "Opened Ferring Supplier Master portal",
                "Located supplier record SUP-61108 (Catalent Pharma Solutions)",
                "Added review log: \"PR-2026-01045 escalated to senior procurement — amount EUR 185,000 exceeds auto-approval threshold\"",
                "Review status: Pending Senior Decision",
                "Senior reviewer notified: procurement-lead@ferring.com"
            ]
        },
        // STEP 10: SAP Ariba approval
        {
            id: "step-10",
            title_p: "Approving PR in SAP Ariba...",
            title_s: "PR-2026-01045 approved in SAP Ariba — manual review notes posted",
            reasoning: [
                "Desktop agent navigated to PR-2026-01045 in SAP Ariba",
                "Selected 'Approve' action",
                "Posted approval comment: '12/14 auto-passed. 2 items confirmed by manual review: service type terminology variant + German entity name variant. Approved by Pace + human reviewer. Ref: FPR-003.'",
                "Status: Pending Approval → Approved",
                "Confirmation received (200 OK)"
            ],
            artifacts: [
                {
                    id: "ariba-confirm-3",
                    type: "json",
                    label: "SAP Ariba Approval Confirmation",
                    data: {
                        action: "APPROVED",
                        pr_id: "PR-2026-01045",
                        status_before: "Pending Approval",
                        status_after: "Approved",
                        approval_type: "Manual Review Override",
                        approval_comment: "12/14 auto-passed. 2 MANUAL_REVIEW items confirmed by human reviewer. Approved by Pace + reviewer. Ref: FPR-003.",
                        timestamp: "2026-03-26T11:45:00Z",
                        api_response: "200 OK"
                    }
                }
            ]
        },
        // STEP 10: Audit trail
        {
            id: "step-11",
            title_p: "Finalizing audit trail...",
            title_s: "Process complete — PR-2026-01045 approved after manual review, full audit trail archived",
            reasoning: [
                "Processing duration: 1m 15s (excluding human review wait)",
                "Supplier Master verification completed: Catalent Pharma Solutions SUP-61108 confirmed",
                "14 validations: 12 auto-pass, 2 manual review (both approved)",
                "Human reviewer decision logged for compliance",
                "PR approved in SAP Ariba"
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

        if (step.id === "step-7") {
            // Manual review gate — show warning and wait for signal
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'warning',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', 'Manual Review: 2 items require human confirmation');
            await waitForSignal("APPROVE_MANUAL_REVIEW");
            await updateProcessListStatus(PROCESS_ID, 'In Progress', 'Manual review approved — continuing');
        } else {
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
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
