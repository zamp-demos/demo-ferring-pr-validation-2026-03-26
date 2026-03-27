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

    const steps = [

        // ── STAGE 1: Regional Queue Management ──────────────────────────────
        {
            id: "step-1",
            title_p: "Accessing SAP Ariba pending approvals queue...",
            title_s: "SAP Ariba queue: 3 pending PRs found — selected PR-2026-01045 (FIFO)",
            reasoning: [
                "Agent accesses SAP Ariba as pace.agent@ferring.com",
                "Queried pending approvals for Zamp.ai_test — 3 PRs in queue",
                "FIFO selection: oldest unprocessed PR is PR-2026-01045 (created 2026-03-20)",
                "PR-2026-01045: Catalent Pharma Solutions, EUR 185,000.00, Company Code 3200, India/ROW region",
                "Selected PR-2026-01045 for processing"
            ]
        },

        // ── STAGE 2: Authentication and PR Retrieval ─────────────────────────
        {
            id: "step-2",
            title_p: "Authenticating to SAP Ariba and retrieving PR details...",
            title_s: "Connected to SAP Ariba — PR-2026-01045 opened, Catalent Pharma Solutions, EUR 185,000.00",
            reasoning: [
                "Authenticated as pace.agent@ferring.com — session established",
                "Navigated to Manage → Purchase Requisitions",
                "Opened PR-2026-01045 detail view — status: Pending Approval",
                "Read Requester: Dr. Lena Fischer",
                "Read Budget Owner: Prof. Wilhelm Braun",
                "Read Company Code: 3200 (Ferring GmbH, Kiel, Germany)",
                "Read PO Owner: Dr. Lena Fischer",
                "Read Cost Center: CC-CLIN-DE-014",
                "Read Currency: EUR — Total Amount: EUR 185,000.00",
                "Read Supplier: Catalent Pharma Solutions (Supplier ID: SUP-61108)",
                "Read Region: India/ROW — PR date: 2026-03-20"
            ],
            artifacts: [
                {
                    id: "pr-header-3",
                    type: "json",
                    label: "PR Header Data",
                    data: {
                        pr_id: "PR-2026-01045",
                        company_code: "3200",
                        entity: "Ferring GmbH",
                        requester: "Dr. Lena Fischer",
                        budget_owner: "Prof. Wilhelm Braun",
                        po_owner: "Dr. Lena Fischer",
                        cost_center: "CC-CLIN-DE-014",
                        currency: "EUR",
                        total_amount: "185,000.00",
                        supplier: "Catalent Pharma Solutions",
                        supplier_id: "SUP-61108",
                        region: "India/ROW",
                        pr_date: "2026-03-20",
                        line_items_count: 3,
                        status: "Pending Approval"
                    }
                }
            ]
        },

        // ── STAGE 3: Data Extraction and Transformation ──────────────────────
        {
            id: "step-3",
            title_p: "Extracting PR data — header fields, line items, and supplier enrichment...",
            title_s: "3 line items extracted — EUR 185,000.00 total, supplier enriched via Supplier Master",
            reasoning: [
                "Clicked Line Items tab in PR detail view",
                "Line 1: Clinical Trial Supply & Packaging — 1 LOT × EUR 85,000.00 = EUR 85,000.00, MG-PKG-001",
                "Line 2: Labelling Services — 1 LOT × EUR 65,000.00 = EUR 65,000.00, MG-PKG-001",
                "Line 3: Distribution Coordination — 1 LOT × EUR 35,000.00 = EUR 35,000.00, MG-PKG-001",
                "Sum check: EUR 85,000 + EUR 65,000 + EUR 35,000 = EUR 185,000.00 — matches PR header ✓",
                "Supplier Master enrichment: looked up SUP-61108 in master DB",
                "Retrieved registered name: 'Catalent Pharma Solutions', full legal: 'Catalent Pharma Solutions Inc.', status: Active",
                "Retrieved ordering method: EMAIL (catalent-orders@catalent.com), payment terms: Net 45, region: Global",
                "Supplier status confirmed: Active — no purchasing blocks, no compliance flags",
                "Name match score: 95% (short form vs full legal name — above 90% threshold)"
            ],
            artifacts: [
                {
                    id: "line-items-3",
                    type: "json",
                    label: "PR Line Items",
                    data: {
                        line_items: [
                            { line: "1", description: "Clinical Trial Supply & Packaging", qty: "1 LOT", unit_price: "EUR 85,000.00", total: "EUR 85,000.00", material_group: "MG-PKG-001" },
                            { line: "2", description: "Labelling Services", qty: "1 LOT", unit_price: "EUR 65,000.00", total: "EUR 65,000.00", material_group: "MG-PKG-001" },
                            { line: "3", description: "Distribution Coordination", qty: "1 LOT", unit_price: "EUR 35,000.00", total: "EUR 35,000.00", material_group: "MG-PKG-001" }
                        ],
                        sum_check: "EUR 185,000.00 = PR header total ✓",
                        supplier_enrichment: {
                            supplier_id: "SUP-61108",
                            registered_name: "Catalent Pharma Solutions",
                            full_legal_name: "Catalent Pharma Solutions Inc.",
                            status: "Active",
                            name_match_score: "95%",
                            ordering_method: "EMAIL",
                            ordering_email: "catalent-orders@catalent.com",
                            payment_terms: "Net 45",
                            region: "Global",
                            purchasing_blocks: "None",
                            compliance_flags: "None"
                        }
                    }
                }
            ]
        },

        // ── STAGE 4: Attachment Processing (Validation 1/14) ─────────────────
        {
            id: "step-4",
            title_p: "Checking attachments tab — downloading and classifying documents...",
            title_s: "Validation 1/14: SOW identified (confidence: 0.88) — downloaded",
            reasoning: [
                "Clicked Attachments tab in PR detail view",
                "Found 1 attachment: Catalent_SOW_Packaging_2026.pdf (8 pages, 445KB)",
                "Document classification model applied",
                "Document type: Statement of Work — confidence: 0.88",
                "Downloaded to processing queue for structured data extraction"
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

        // ── STAGE 5: Structured Data Extraction from Document ────────────────
        {
            id: "step-5",
            title_p: "Extracting structured data from SOW...",
            title_s: "Structured data extracted — EUR 185,000.00 confirmed, service descriptions mapped",
            reasoning: [
                "Extracted Supplier: Catalent Pharma Solutions Inc.",
                "Extracted Service Description: 'Clinical Trial Supply & Packaging'",
                "Extracted Total Value: EUR 185,000.00 — matches PR header ✓",
                "Extracted Work Package 1: Packaging — EUR 85,000.00",
                "Extracted Work Package 2: Labelling — EUR 65,000.00",
                "Extracted Work Package 3: Distribution — EUR 35,000.00",
                "Extracted Contract Term: 12 months, 2026-04-01 through 2027-03-31",
                "Extracted Company reference: 'Ferring Gesellschaft mit beschraenkter Haftung' (German full legal name for Ferring GmbH)",
                "Note: PR description reads 'Pharmaceutical Packaging Services' vs SOW 'Clinical Trial Supply & Packaging' — terminology differs, flagged for validation"
            ],
            artifacts: [
                {
                    id: "extracted-3",
                    type: "json",
                    label: "Extracted SOW Data",
                    data: {
                        supplier: "Catalent Pharma Solutions Inc.",
                        service_description_sow: "Clinical Trial Supply & Packaging",
                        service_description_pr: "Pharmaceutical Packaging Services",
                        total_value: "EUR 185,000.00",
                        pr_amount: "EUR 185,000.00",
                        amount_match: "MATCH ✓",
                        work_packages: [
                            { pkg: "1", description: "Packaging", value: "EUR 85,000.00" },
                            { pkg: "2", description: "Labelling", value: "EUR 65,000.00" },
                            { pkg: "3", description: "Distribution", value: "EUR 35,000.00" }
                        ],
                        contract_term: "2026-04-01 to 2027-03-31 (12 months)",
                        company_on_document: "Ferring Gesellschaft mit beschraenkter Haftung",
                        company_on_master: "Ferring GmbH",
                        company_note: "German full legal name vs abbreviated form — flagged for V12 validation"
                    }
                }
            ]
        },

        // ── STAGE 6a: Comprehensive Validation V2–V8 ─────────────────────────
        {
            id: "step-6a",
            title_p: "Running validation domains 2–8...",
            title_s: "Validations 2–7 PASS — V8 Service Type MANUAL_REVIEW (match score: 0.62)",
            reasoning: [
                "V2 Accounting: Cost Center CC-CLIN-DE-014, GL 67100200 — consistent ✓ PASS",
                "V3 Budget Owner: Prof. Wilhelm Braun ≠ Dr. Lena Fischer (requester) — segregation confirmed ✓ PASS",
                "V4 Currency: EUR consistent across PR, line items, and SOW ✓ PASS",
                "V5 Material Group: MG-PKG-001 found in GL Exception List ✓ PASS",
                "V6 Supplier: Catalent Pharma Solutions — 95% match to SUP-61108 (above 90% threshold) ✓ PASS",
                "V7 Pricing: EUR 185,000.00 = EUR 185,000.00 exact match ✓ PASS",
                "V8 Service Type: 'Clinical Trial Supply & Packaging' (SOW) vs 'Pharmaceutical Packaging Services' (PR) — semantic match score 0.62 — below 0.75 auto-pass threshold — MANUAL_REVIEW"
            ],
            artifacts: [
                {
                    id: "val-v2-v8-3",
                    type: "json",
                    label: "Validation Results V2–V8",
                    data: {
                        V2_Accounting: "PASS",
                        V3_BudgetOwner: "PASS",
                        V4_Currency: "PASS",
                        V5_MaterialGroup: "PASS",
                        V6_SupplierID: "PASS (95% match — Catalent Pharma Solutions = SUP-61108)",
                        V7_Pricing: "PASS (EUR 185,000 = EUR 185,000 exact)",
                        V8_ServiceType: {
                            result: "MANUAL_REVIEW",
                            sow_description: "Clinical Trial Supply & Packaging",
                            pr_description: "Pharmaceutical Packaging Services",
                            match_score: 0.62,
                            threshold: 0.75,
                            note: "Both refer to pharmaceutical packaging but different terminology — human confirmation needed"
                        }
                    }
                }
            ]
        },

        // ── STAGE 6b: Comprehensive Validation V9–V14 ────────────────────────
        {
            id: "step-6b",
            title_p: "Running validation domains 9–14...",
            title_s: "V9–V11 PASS — V12 Company Code MANUAL_REVIEW (confidence: 0.78) — V13–V14 PASS",
            reasoning: [
                "V9 Ordering Method: EMAIL, catalent-orders@catalent.com — valid per Supplier Master ✓ PASS",
                "V10 Ship-To: SHIP-DE-001 valid for company code 3200 (Ferring GmbH) ✓ PASS",
                "V11 Sold-To: 3200 = 3200 — exact match ✓ PASS",
                "V12 Company Code: Document shows 'Ferring Gesellschaft mit beschraenkter Haftung' vs master 'Ferring GmbH' — likely same entity (German full legal vs abbreviated), confidence 0.78 — MANUAL_REVIEW",
                "V13 Quantity: all 3 line items verified at Level 2 (sum and unit checks) ✓ PASS",
                "V14 Deliver-To: Ferring GmbH, Wittland 11, 24109 Kiel — valid for CC-CLIN-DE-014 ✓ PASS",
                "Overall: 12 PASS, 0 FAIL, 2 MANUAL_REVIEW (V8 Service Type, V12 Company Code)"
            ],
            artifacts: [
                {
                    id: "val-v9-v14-3",
                    type: "json",
                    label: "Validation Results V9–V14 + Scorecard",
                    data: {
                        V9_OrderingMethod: "PASS",
                        V10_ShipTo: "PASS",
                        V11_SoldTo: "PASS",
                        V12_CompanyCode: {
                            result: "MANUAL_REVIEW",
                            document_entity: "Ferring Gesellschaft mit beschraenkter Haftung",
                            master_entity: "Ferring GmbH",
                            confidence: 0.78,
                            note: "German full legal name vs abbreviated form — likely same entity, human confirmation needed"
                        },
                        V13_Quantity: "PASS",
                        V14_DeliverTo: "PASS",
                        scorecard: {
                            overall_status: "MANUAL_REVIEW",
                            total: 14, passed: 12, failed: 0, manual_review: 2
                        }
                    }
                }
            ]
        },

        // ── STAGE 7: Automated Action — Prepare Review Items ─────────────────
        {
            id: "step-7",
            title_p: "Overall status: MANUAL_REVIEW — preparing review items for human confirmation...",
            title_s: "2 items require human confirmation — MANUAL_REVIEW package prepared",
            reasoning: [
                "12 of 14 validations passed automatically",
                "Item 1 for review: V8 Service Type — 'Clinical Trial Supply & Packaging' vs 'Pharmaceutical Packaging Services' (score 0.62)",
                "Item 2 for review: V12 Company Code — German full legal name 'Ferring Gesellschaft mit beschraenkter Haftung' vs abbreviated 'Ferring GmbH' (confidence 0.78)",
                "No hard failures — process can be approved if reviewer confirms both items are acceptable",
                "Awaiting reviewer decision to proceed"
            ]
        },

        // ── STAGE 8: HITL Gate — Reviewer confirms ────────────────────────────
        {
            id: "step-8",
            hitl: true,
            title_p: "Presenting manual review items to reviewer — awaiting confirmation...",
            title_s: "Manual review items ready — awaiting reviewer decision",
            reasoning: [
                "Item 1: V8 Service Type — confirm 'Clinical Trial Supply & Packaging' is consistent with 'Pharmaceutical Packaging Services'",
                "Item 2: V12 Company Code — confirm 'Ferring Gesellschaft mit beschraenkter Haftung' (German full legal name) is the same entity as 'Ferring GmbH'",
                "Both items are low-risk terminology/naming variants, not substantive discrepancies",
                "Reviewer approval will elevate both MANUAL_REVIEW results to PASS and allow SAP Ariba approval to proceed"
            ],
            artifacts: [
                {
                    id: "review-items-3",
                    type: "json",
                    label: "Manual Review Package",
                    data: {
                        pr_id: "PR-2026-01045",
                        overall_status: "MANUAL_REVIEW",
                        passed_auto: 12,
                        items_for_review: [
                            {
                                id: "MR-1",
                                validation: "V8 Service Type",
                                match_score: 0.62,
                                document_value: "Clinical Trial Supply & Packaging",
                                pr_value: "Pharmaceutical Packaging Services",
                                question: "Do these service descriptions refer to the same scope of work?"
                            },
                            {
                                id: "MR-2",
                                validation: "V12 Company Code",
                                confidence: 0.78,
                                document_value: "Ferring Gesellschaft mit beschraenkter Haftung",
                                master_value: "Ferring GmbH",
                                question: "Does this German full legal name match Ferring GmbH (Company Code 3200)?"
                            }
                        ]
                    }
                }
            ]
        },

        // ── Post-HITL: Approved — update validations and proceed ─────────────
        {
            id: "step-8b",
            title_p: "Manual review approved — updating validation results...",
            title_s: "Reviewer confirmed both items — V8 and V12 elevated to PASS, overall status: PASS",
            reasoning: [
                "Reviewer confirmed: 'Clinical Trial Supply & Packaging' is consistent with 'Pharmaceutical Packaging Services' ✓",
                "Reviewer confirmed: 'Ferring Gesellschaft mit beschraenkter Haftung' is the German full legal name for Ferring GmbH (Company Code 3200) ✓",
                "V8 Service Type: MANUAL_REVIEW → PASS (reviewer override)",
                "V12 Company Code: MANUAL_REVIEW → PASS (reviewer override)",
                "Overall validation status elevated to PASS — proceeding to SAP Ariba approval"
            ]
        },

        // ── STAGE 9: Approve in SAP Ariba ────────────────────────────────────
        {
            id: "step-9",
            title_p: "Approving PR-2026-01045 in SAP Ariba...",
            title_s: "PR-2026-01045 approved in SAP Ariba — status: Pending Approval → Approved",
            reasoning: [
                "Desktop agent navigated to PR-2026-01045 in SAP Ariba",
                "Selected 'Approve' action from approver actions menu",
                "Approval comment posted: '12/14 auto-passed. 2 MANUAL_REVIEW items confirmed by human reviewer: V8 service type terminology variant (score 0.62) and V12 German entity name variant (confidence 0.78). Approved by Pace + reviewer. Ref: FPR-003.'",
                "Status changed: Pending Approval → Approved",
                "System confirmation received (200 OK)"
            ],
            artifacts: [
                {
                    id: "ariba-confirm-3",
                    type: "json",
                    label: "SAP Ariba Approval Confirmation",
                    data: {
                        pr_id: "PR-2026-01045",
                        action: "APPROVE",
                        status_before: "Pending Approval",
                        status_after: "Approved",
                        approval_type: "Manual Review Override",
                        approval_comment: "12/14 auto-passed. 2 MANUAL_REVIEW items confirmed by human reviewer: V8 service type terminology variant and V12 German entity name variant. Approved by Pace + reviewer. Ref: FPR-003.",
                        timestamp: "2026-03-26T11:45:00Z",
                        confirmed_by: "Pace Automation Agent + Human Reviewer",
                        api_response: "200 OK"
                    }
                }
            ]
        },

        // ── STAGE 9: Audit Trail ──────────────────────────────────────────────
        {
            id: "step-10",
            title_p: "Finalizing audit trail...",
            title_s: "Process complete — PR-2026-01045 approved after manual review, full audit trail archived",
            reasoning: [
                "Processing duration: 1m 15s (excluding HITL wait time)",
                "Validations run: 14 — 12 auto-passed, 2 manual review (both confirmed by reviewer)",
                "HITL gate triggered: 1 (reviewer confirmation of terminology variants)",
                "Supplier Master lookup completed: Catalent Pharma Solutions SUP-61108 confirmed (95% name match)",
                "Human reviewer decision logged for compliance",
                "SAP Ariba final status: Approved",
                "All artifacts archived for compliance and audit"
            ],
            artifacts: [
                {
                    id: "audit-trail-3",
                    type: "json",
                    label: "Complete Audit Trail",
                    data: {
                        process_id: "FPR_003",
                        pr_id: "PR-2026-01045",
                        supplier: "Catalent Pharma Solutions (SUP-61108)",
                        amount: "EUR 185,000.00",
                        started: "2026-03-26T10:15:00Z",
                        completed: "2026-03-26T11:45:00Z",
                        outcome: "APPROVED",
                        validations: { run: 14, passed: 12, failed: 0, manual_review: 2 },
                        hitl_gates_triggered: 1,
                        manual_review_items: 2,
                        reviewer_confirmed: true,
                        supplier_master_checked: true,
                        sap_ariba_updated: true,
                        approval_basis: "Auto-pass (12/14) + manual reviewer confirmation (2/14)"
                    }
                }
            ]
        }
    ];

    // ── Execution loop ────────────────────────────────────────────────────────
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Show processing state
        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: timeStr,
            title: step.title_p,
            status: 'processing'
        });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        if (step.hitl) {
            // HITL gate — set action-needed, block on poll
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'action-needed',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', 'Needs Attention — Manual Review: 2 items require human confirmation');
            await setHitlPending(PROCESS_ID);
            const action = await pollHitl(PROCESS_ID);

            if (action === 'approve' || action === 'send') {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'Manual review confirmed by reviewer — continuing to SAP Ariba approval',
                    status: 'success',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', 'Manual review confirmed — proceeding to approval');
                await delay(1500);
            } else {
                updateProcessLog(PROCESS_ID, {
                    id: step.id,
                    title: 'Process halted by reviewer at manual review gate',
                    status: 'warning',
                    reasoning: step.reasoning || [],
                    artifacts: step.artifacts || []
                });
                await updateProcessListStatus(PROCESS_ID, 'Done', 'Halted by reviewer at manual review gate');
                console.log(`${PROCESS_ID}: Process halted by reviewer.`);
                return;
            }

        } else if (isFinal) {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'completed',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'Done', step.title_s);

        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: 'success',
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
