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

const waitForEmail = async () => {
    console.log("Waiting for user to send email...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    try { await fetch(`${API_URL}/email-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent: false }) }); } catch (e) {}
    while (true) {
        try {
            const response = await fetch(`${API_URL}/email-status`);
            if (response.ok) { const { sent } = await response.json(); if (sent) { console.log("Email Sent!"); return true; } }
        } catch (e) { }
        await delay(2000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);
    const steps = [
        {id:"step-1",title_p:"Desktop agent connecting to SAP Ariba...",title_s:"Connected to SAP Ariba - PR-2026-00912 retrieved",reasoning:["Authenticated as pace.agent@ferring.com","PR-2026-00912 fetched from pending queue","Company Code: 2100 (Ferring Pharmaceuticals Pvt Ltd, India)"],artifacts:[{id:"v-ariba-2",type:"video",label:"SAP Ariba: PR Data Pull",videoPath:"/data/sap_ariba_pr_pull_fpr002.webm"}]},
        {id:"step-2",title_p:"Extracting PR header and line items...",title_s:"PR data extracted - 2 line items, Supplier: Bachem AG",reasoning:["Requester: Rajesh Krishnamurthy","PO Owner: Rajesh Krishnamurthy","Budget Owner: Dr. Anita Sharma","Supplier on PR: Bachem AG (ID: SUP-77234)","Total: USD 45,800.00"],artifacts:[{id:"pr-h-2",type:"json",label:"PR Header Data",data:{pr_id:"PR-2026-00912",company_code:"2100",entity:"Ferring Pharmaceuticals Pvt Ltd",requester:"Rajesh Krishnamurthy",supplier_on_pr:"Bachem AG",supplier_id:"SUP-77234",currency:"USD",total_amount:"45,800.00"}}]},
        {id:"step-3",title_p:"Downloading and classifying attachment...",title_s:"Validation 1/14: Invoice identified (confidence: 0.92)",reasoning:["Downloaded: Bachem_INV_2026_0912.pdf (3 pages)","Document type: Invoice (confidence 0.92)","Invoice date: 2026-03-10","Due date: 2026-04-10"],artifacts:[{id:"pdf-2",type:"file",label:"Invoice - Bachem Holding AG",pdfPath:"/data/bachem_invoice_2026.pdf"}]},
        {id:"step-4",title_p:"Extracting structured data from invoice...",title_s:"Data extracted - supplier name discrepancy detected",reasoning:["Document supplier: Bachem Holding AG","PR supplier: Bachem AG","Document total: USD 48,200.00","PR total: USD 45,800.00","Variance detected: +USD 2,400.00 (5.24% overage)"]},
        {id:"step-5",title_p:"Running validation suite (14 domains)...",title_s:"Validations 2-7: Accounting PASS, Budget PASS, Currency PASS, Material PASS, Supplier MANUAL_REVIEW, Pricing FAIL",reasoning:["V2 Accounting: Assignment K, Cost Center, GL consistent - PASS","V3 Budget: Dr. Anita Sharma != Rajesh Krishnamurthy - PASS","V4 Currency: USD matches - PASS","V5 Material Group: MG-API-002 found in master - PASS","V6 Supplier: Bachem Holding AG vs Bachem AG - 72% match - MANUAL_REVIEW","V7 Pricing: PR USD 45,800 vs Doc USD 48,200 - difference USD 2,400 - FAIL"],artifacts:[{id:"sup-val-2",type:"json",label:"Supplier Validation Detail",data:{pr_supplier:"Bachem AG",document_supplier:"Bachem Holding AG",match_score:"72%",threshold:"90% for auto-pass",status:"MANUAL_REVIEW",note:"Legal entity name vs trade name discrepancy"}},{id:"price-val-2",type:"json",label:"Pricing Validation Detail",data:{pr_total:"USD 45,800.00",document_total:"USD 48,200.00",difference:"USD 2,400.00",variance_pct:"5.24%",variance_type:"overage",status:"FAIL"}}]},
        {id:"step-6",title_p:"Completing validations 8-14...",title_s:"Validations 8-14 complete: all PASS",reasoning:["V8-V14: Service Type, Ordering, Ship-To, Sold-To, Company Code, Quantity, Deliver-To - all PASS","12 of 14 validations passed","1 FAIL (Pricing), 1 MANUAL_REVIEW (Supplier)"]},
        {id:"step-7",title_p:"Determining overall status...",title_s:"Overall status: FAIL - pricing mismatch requires resolution",reasoning:["FAIL takes precedence over MANUAL_REVIEW","Primary issue: USD 2,400 pricing overage","Secondary issue: Supplier name mismatch (72% confidence)","Action: Draft email to requester with failure details"],artifacts:[{id:"val-sum-2",type:"json",label:"Validation Summary",data:{overall_status:"FAIL",passed:12,failed:1,manual_review:1,key_issues:["Pricing variance: +USD 2,400 (5.24%)","Supplier name: 72% match (below 90% threshold)"]}}]},
        {id:"step-8",hitl:"email",title_p:"Drafting rejection email to requester...",title_s:"Email draft ready for review",reasoning:["Email addressed to Rajesh Krishnamurthy (requester)","CC: procurement-india@ferring.com","Details pricing variance and supplier name discrepancy","Requests updated invoice or PR amendment within 5 business days"],artifacts:[{id:"email-2",type:"email_draft",label:"Email: PR Rejection Notice",data:{isIncoming:false,to:"rajesh.krishnamurthy@ferring.com",cc:"procurement-india@ferring.com, validation-team@ferring.com",subject:"Action Required: Purchase Requisition PR-2026-00912 - Pricing Discrepancy",body:"Dear Rajesh,\n\nRegarding Purchase Requisition: PR-2026-00912\n\nDuring automated validation of your PR for Bachem AG, the following issues were identified:\n\n1. PRICING MISMATCH (Critical):\n   - PR Total: USD 45,800.00\n   - Invoice Total: USD 48,200.00\n   - Variance: +USD 2,400.00 (5.24% overage)\n   The invoice amount exceeds the PR amount. Please verify with the supplier and submit either a corrected invoice or an amended PR.\n\n2. SUPPLIER NAME DISCREPANCY:\n   - PR Supplier: Bachem AG\n   - Invoice Supplier: Bachem Holding AG\n   - Match Confidence: 72%\n   Please confirm these refer to the same legal entity.\n\nRequired Actions:\n- Obtain corrected invoice from Bachem matching PR amount, OR\n- Submit amended PR reflecting the correct amount\n- Confirm supplier entity name\n\nPlease respond within 5 business days.\n\nBest regards,\nFerring Procurement Validation Team"}}]},
        {id:"step-9",title_p:"Rejecting PR in SAP Ariba...",title_s:"PR-2026-00912 rejected in SAP Ariba - reasoning posted",reasoning:["Rejection comment posted to SAP Ariba","Status: Rejected","Reason: Pricing variance USD 2,400 + supplier name mismatch"]},
        {id:"step-10",title_p:"Finalizing audit trail...",title_s:"Process complete - PR-2026-00912 rejected with full audit trail",reasoning:["Email sent to requester","PR rejected in SAP Ariba with validation reasoning","Full audit trail archived","Processing duration: 52 seconds"]}
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
            await waitForEmail();
            updateProcessLog(PROCESS_ID, { id: step.id, title: 'Email sent successfully', status: 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
            await updateProcessListStatus(PROCESS_ID, 'In Progress', 'Email sent');
            await delay(1500);
        } else {
            updateProcessLog(PROCESS_ID, { id: step.id, title: step.title_s, status: isFinal ? 'completed' : 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
            await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
            await delay(1500);
        }
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
