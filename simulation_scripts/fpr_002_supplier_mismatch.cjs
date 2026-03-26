const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_002";
const CASE_NAME = "Supplier & Pricing Mismatch";

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

// Per-process HITL: polls /hitl/FPR_002
const waitForHITL = async () => {
    console.log("FPR_002: Waiting for HITL action (send or reject)...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    // Reset this process's HITL state to pending=true, action=null
    try {
        await fetch(`${API_URL}/hitl/FPR_002`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pending: true, action: null })
        });
    } catch (e) { console.error('FPR_002: Failed to set HITL pending state:', e.message); }

    // Also keep legacy /email-status reset for backwards compat
    try { await fetch(`${API_URL}/email-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent: false }) }); } catch (e) {}

    while (true) {
        await delay(2000);
        try {
            const response = await fetch(`${API_URL}/hitl/FPR_002`);
            if (response.ok) {
                const { action } = await response.json();
                if (action === 'send') { console.log("FPR_002: Email sent!"); return 'send'; }
                if (action === 'reject') { console.log("FPR_002: Rejected!"); return 'reject'; }
            }
        } catch (e) { }
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);
    const steps = [
        {id:"step-1",title_p:"Desktop agent connecting to SAP Ariba...",title_s:"Connected to SAP Ariba - PR-2026-00912 retrieved",reasoning:["Authenticated as pace.agent@ferring.com","Session established (SESS-2026-03-26-0312)","Navigated to Pending Approvals queue","PR-2026-00912 located and opened","Read PR header: Company Code = 2100 (Ferring Pharmaceuticals Pvt Ltd, India)","Read Requester: Rajesh Krishnamurthy","Read Budget Owner: Dr. Anita Sharma","Read Cost Center: CC-API-IN-003","Read Currency: USD","Read Total: USD 45,800.00"],artifacts:[{id:"v-ariba-2",type:"video",label:"SAP Ariba: PR Data Pull",videoPath:"/data/sap_ariba_pr_pull_fpr002.webm"},{id:"ariba-header-2",type:"json",label:"SAP Ariba Session Log",data:{session:"SESS-2026-03-26-0312",agent:"pace.agent@ferring.com",actions:[{timestamp:"09:18:01",action:"Authenticate to SAP Ariba",status:"Success"},{timestamp:"09:18:03",action:"Navigate to Pending Approvals",status:"Success"},{timestamp:"09:18:05",action:"Search PR-2026-00912",status:"Found"},{timestamp:"09:18:07",action:"Open PR Details",status:"Success"},{timestamp:"09:18:09",action:"Read PR header fields",status:"Complete"},{timestamp:"09:18:11",action:"Download attachment: Bachem_INV_2026_0912.pdf",status:"Complete"}]}}]},
        {id:"step-2",title_p:"Extracting PR header and line items...",title_s:"PR data extracted - 2 line items, Supplier: Bachem AG",reasoning:["Requester: Rajesh Krishnamurthy","PO Owner: Rajesh Krishnamurthy","Budget Owner: Dr. Anita Sharma","Supplier on PR: Bachem AG (ID: SUP-77234)","Line Item 1: API Peptide Synthesis - USD 28,500.00 (qty 1)","Line Item 2: GMP Documentation Package - USD 17,300.00 (qty 1)","Total: USD 45,800.00"],artifacts:[{id:"pr-h-2",type:"json",label:"PR Header Data",data:{pr_id:"PR-2026-00912",company_code:"2100",entity:"Ferring Pharmaceuticals Pvt Ltd",requester:"Rajesh Krishnamurthy",supplier_on_pr:"Bachem AG",supplier_id:"SUP-77234",currency:"USD",total_amount:"45,800.00",line_items:[{item:"1",description:"API Peptide Synthesis Services",amount:"USD 28,500.00",qty:1},{item:"2",description:"GMP Documentation Package",amount:"USD 17,300.00",qty:1}]}}]},
        {id:"step-3",title_p:"Downloading and classifying attachment...",title_s:"Validation 1/14: Invoice identified (confidence: 0.92)",reasoning:["Downloaded: Bachem_INV_2026_0912.pdf (3 pages, 284KB)","Document type: Invoice (confidence 0.92)","Invoice date: 2026-03-10","Due date: 2026-04-10","Invoice number: BI-2026-03-0912"],artifacts:[{id:"pdf-2",type:"file",label:"Invoice - Bachem Holding AG",pdfPath:"/data/bachem_invoice_2026.pdf"}]},
        {id:"step-4",title_p:"Extracting structured data from invoice...",title_s:"Data extracted - supplier name discrepancy detected",reasoning:["Extracted: Supplier name on document = 'Bachem Holding AG'","PR supplier name = 'Bachem AG'","Name match score: 72% (below 90% threshold)","Extracted: Invoice total = USD 48,200.00","PR total = USD 45,800.00","Variance: +USD 2,400.00 (5.24% overage)","PRICING DISCREPANCY: Invoice exceeds PR by USD 2,400"]},
        {id:"step-5",title_p:"Running validation suite (14 domains)...",title_s:"Validations 2-7: Accounting PASS, Budget PASS, Currency PASS, Material PASS, Supplier MANUAL_REVIEW, Pricing FAIL",reasoning:["V2 Accounting: Assignment K, Cost Center CC-API-IN-003, GL consistent - PASS","V3 Budget: Dr. Anita Sharma != Rajesh Krishnamurthy - PASS","V4 Currency: USD matches throughout - PASS","V5 Material Group: MG-API-002 found in approved master list - PASS","V6 Supplier: 'Bachem Holding AG' vs 'Bachem AG' - 72% match - MANUAL_REVIEW (threshold: 90%)","V7 Pricing: PR USD 45,800 vs Invoice USD 48,200 - difference USD 2,400 - FAIL"],artifacts:[{id:"sup-val-2",type:"json",label:"Supplier Validation Detail",data:{pr_supplier:"Bachem AG",document_supplier:"Bachem Holding AG",match_score:"72%",threshold:"90% for auto-pass",status:"MANUAL_REVIEW",note:"Legal entity name vs trade name discrepancy - possible parent/subsidiary relationship"}},{id:"price-val-2",type:"json",label:"Pricing Validation Detail",data:{pr_total:"USD 45,800.00",document_total:"USD 48,200.00",difference:"USD 2,400.00",variance_pct:"5.24%",variance_type:"overage",status:"FAIL"}}]},
        {id:"step-6",title_p:"Completing validations 8-14...",title_s:"Validations 8-14 complete: all PASS",reasoning:["V8 Service Type: API Manufacturing - PASS (confidence 0.91)","V9 Ordering: Standard - PASS","V10 Ship-To: SHIP-IN-003 valid - PASS","V11 Sold-To: 2100 = 2100 - PASS","V12 Company Code: Ferring Pharmaceuticals Pvt Ltd - PASS (confidence 0.99)","V13 Quantity: Match at Level 2 - PASS","V14 Deliver-To: Valid content - PASS","12 of 14 validations passed | 1 FAIL | 1 MANUAL_REVIEW"]},
        {id:"step-7",title_p:"Determining overall status...",title_s:"Overall status: FAIL - pricing mismatch requires resolution",reasoning:["FAIL takes precedence over MANUAL_REVIEW per validation ruleset","Primary issue: USD 2,400 pricing overage (5.24%)","Secondary issue: Supplier name mismatch (72% confidence - below 90% threshold)","Action: Draft rejection email to requester with full details"],artifacts:[{id:"val-sum-2",type:"json",label:"Validation Summary",data:{overall_status:"FAIL",passed:12,failed:1,manual_review:1,key_issues:["Pricing variance: +USD 2,400 (5.24%) - invoice exceeds PR","Supplier name: 72% match (below 90% threshold)"]}}]},
        {id:"step-8",hitl:"email",title_p:"Drafting rejection email to requester...",title_s:"Email draft ready for review - approve to send",reasoning:["Email addressed to Rajesh Krishnamurthy (requester)","CC: procurement-india@ferring.com","Details pricing variance and supplier name discrepancy","Requests updated invoice or PR amendment within 5 business days","Awaiting procurement team approval to send"],artifacts:[{id:"email-2",type:"email_draft",label:"Email: PR Rejection Notice",data:{isIncoming:false,to:"rajesh.krishnamurthy@ferring.com",cc:"procurement-india@ferring.com, validation-team@ferring.com",subject:"Action Required: Purchase Requisition PR-2026-00912 - Pricing Discrepancy",body:"Dear Rajesh,\n\nRegarding Purchase Requisition: PR-2026-00912\n\nDuring automated validation of your PR for Bachem AG, the following issues were identified:\n\n1. PRICING MISMATCH (Critical):\n   - PR Total: USD 45,800.00\n   - Invoice Total: USD 48,200.00\n   - Variance: +USD 2,400.00 (5.24% overage)\n   The invoice amount exceeds the PR amount. Please verify with the supplier and submit either a corrected invoice or an amended PR.\n\n2. SUPPLIER NAME DISCREPANCY:\n   - PR Supplier: Bachem AG\n   - Invoice Supplier: Bachem Holding AG\n   - Match Confidence: 72%\n   Please confirm these refer to the same legal entity.\n\nRequired Actions:\n- Obtain corrected invoice from Bachem matching PR amount, OR\n- Submit amended PR reflecting the correct amount\n- Confirm supplier entity name\n\nPlease respond within 5 business days.\n\nBest regards,\nFerring Procurement Validation Team"}}]},
        {id:"step-9",title_p:"Rejecting PR in SAP Ariba...",title_s:"PR-2026-00912 rejected in SAP Ariba - reasoning posted",reasoning:["Desktop agent re-accessed SAP Ariba","Navigated to PR-2026-00912","Selected 'Reject' action","Rejection comment: 'Invoice amount USD 48,200 exceeds PR amount USD 45,800 (variance +5.24%). Supplier name mismatch: Bachem Holding AG vs Bachem AG (72% confidence). Please resubmit with corrected invoice.'","Status changed: Pending → Rejected","Confirmation received (200 OK)"],artifacts:[{id:"ariba-reject-2",type:"json",label:"SAP Ariba Rejection Confirmation",data:{pr_id:"PR-2026-00912",action:"REJECT",status_before:"Pending Approval",status_after:"Rejected",rejection_comment:"Invoice amount USD 48,200 exceeds PR amount USD 45,800 (variance +5.24%). Supplier name mismatch: Bachem Holding AG vs Bachem AG (72% confidence). Please resubmit with corrected invoice.",timestamp:"2026-03-26T09:21:44Z",confirmed_by:"Pace Automation Agent"}}]},
        {id:"step-10",title_p:"Finalizing audit trail...",title_s:"Process complete - PR-2026-00912 rejected with full audit trail",reasoning:["Email sent to requester with validation details","PR rejected in SAP Ariba with full reasoning comment","Complete audit trail archived for compliance","Processing duration: 52 seconds","All 14 validation checks documented"]}
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
        updateProcessLog(PROCESS_ID, { id: step.id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), title: step.title_p, status: 'processing' });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        if (step.hitl === 'email') {
            updateProcessLog(PROCESS_ID, { id: step.id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), title: step.title_s, status: 'warning', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', 'Draft Review: Email Pending');
            const hitlAction = await waitForHITL();
            if (hitlAction === 'send') {
                updateProcessLog(PROCESS_ID, { id: step.id, title: 'Email sent to requester - PR rejected', status: 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', 'Email sent - proceeding with SAP Ariba rejection');
            } else {
                updateProcessLog(PROCESS_ID, { id: step.id, title: 'Process rejected by reviewer', status: 'warning', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
                await updateProcessListStatus(PROCESS_ID, 'Done', 'Rejected by reviewer');
                return;
            }
            await delay(1500);
        } else {
            updateProcessLog(PROCESS_ID, { id: step.id, title: step.title_s, status: isFinal ? 'completed' : 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
            await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
            await delay(1500);
        }
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
