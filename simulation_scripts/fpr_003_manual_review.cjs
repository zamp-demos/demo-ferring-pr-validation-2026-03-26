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
    console.log(`Waiting for human signal: ${signalId}...`);
    const signalFile = path.join(__dirname, '../interaction-signals.json');
    for (let i = 0; i < 15; i++) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (!content) continue;
                const signals = JSON.parse(content);
                if (signals[signalId]) {
                    delete signals[signalId];
                    const tmp = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                    fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
                    fs.renameSync(tmp, signalFile);
                }
                break;
            }
        } catch (e) { await delay(Math.floor(Math.random() * 200) + 100); }
    }
    while (true) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (content) {
                    const signals = JSON.parse(content);
                    if (signals[signalId]) {
                        console.log(`Signal ${signalId} received!`);
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
        {id:"step-1",title_p:"Connecting to SAP Ariba and retrieving PR...",title_s:"PR-2026-01045 retrieved - Catalent Pharma Solutions",reasoning:["Authenticated to SAP Ariba","PR-2026-01045 from pending queue","Company Code: 3200 (Ferring GmbH, Kiel, Germany)","Supplier: Catalent Pharma Solutions","Amount: EUR 185,000.00"]},
        {id:"step-2",title_p:"Downloading and classifying attachment...",title_s:"Validation 1/14: SOW identified (confidence: 0.88)",reasoning:["Downloaded: Catalent_SOW_Packaging_2026.pdf (8 pages)","Document type: Statement of Work (confidence 0.88)","Clinical trial supply packaging services","Start: 2026-04-01, End: 2027-03-31"],artifacts:[{id:"pdf-3",type:"file",label:"SOW - Catalent Pharma Solutions",pdfPath:"/data/catalent_sow_packaging_2026.pdf"}]},
        {id:"step-3",title_p:"Extracting structured data from SOW...",title_s:"Data extracted - service descriptions mapped",reasoning:["Supplier: Catalent Pharma Solutions Inc.","Service: Clinical Trial Supply & Packaging","Total: EUR 185,000.00","12-month contract term","3 work packages identified"]},
        {id:"step-4",title_p:"Running validation suite (domains 2-8)...",title_s:"Validations 2-5 PASS, V6 Supplier PASS (95%), V7 Pricing PASS, V8 Service Type MANUAL_REVIEW",reasoning:["V2 Accounting: Consistent - PASS","V3 Budget Owner: Valid - PASS","V4 Currency: EUR matches - PASS","V5 Material Group: MG-PKG-001 found in GL Exception List - PASS","V6 Supplier: Catalent Pharma Solutions Inc vs Catalent Pharma Solutions - 95% - PASS","V7 Pricing: EUR 185,000 exact match - PASS","V8 Service Type: 'Clinical Trial Supply & Packaging' vs 'Pharmaceutical Packaging Services' - score 0.62 - WEAK MATCH"],artifacts:[{id:"svc-val-3",type:"json",label:"Service Type Validation",data:{document_service_type:"Clinical Trial Supply & Packaging",pr_description:"Pharmaceutical Packaging Services",match_score:0.62,match_status:"weak_match",category_match:0.55,keyword_overlap:0.70,contextual_pattern:0.58,semantic_similarity:0.65,status:"MANUAL_REVIEW"}}]},
        {id:"step-5",title_p:"Completing validations 9-14...",title_s:"V9-V11 PASS, V12 Company Code MANUAL_REVIEW (0.78), V13-V14 PASS",reasoning:["V9 Ordering: EMAIL, catalent-orders@catalent.com valid - PASS","V10 Ship-To: SHIP-DE-001 valid for company code 3200 - PASS","V11 Sold-To: 3200 = 3200, verified - PASS","V12 Company Code: 'Ferring GmbH' vs 'Ferring Gesellschaft mit beschraenkter Haftung' - confidence 0.78 - MANUAL_REVIEW","V13 Quantity: Line items match at Level 2 (sum) - PASS","V14 Deliver-To: Ferring GmbH, Wittland 11, Kiel - valid - PASS"],artifacts:[{id:"cc-val-3",type:"json",label:"Company Code Validation",data:{document_company:"Ferring Gesellschaft mit beschraenkter Haftung",master_entity:"Ferring GmbH",confidence:0.78,status:"MANUAL_REVIEW",note:"Medium confidence - German legal name variant of Ferring GmbH"}}]},
        {id:"step-6",title_p:"Overall status: MANUAL_REVIEW - human decision required",title_s:"2 validations require manual review - awaiting reviewer decision",reasoning:["Service Type: Weak match (0.62) between clinical trial packaging descriptions","Company Code: Medium confidence (0.78) on German legal entity name variant","12 of 14 validations passed","Reviewer should confirm: (1) service descriptions are compatible, (2) Ferring GmbH = Ferring Gesellschaft mit beschraenkter Haftung"],artifacts:[{id:"val-sum-3",type:"json",label:"Validation Summary",data:{overall_status:"MANUAL_REVIEW",passed:12,failed:0,manual_review:2,items_for_review:["Service Type: weak match 0.62","Company Code: medium confidence 0.78"]}}]},
        {id:"step-7",title_p:"Reviewer has approved - continuing processing...",title_s:"Manual review approved - proceeding with PR approval",reasoning:["Reviewer confirmed service descriptions are compatible","Reviewer confirmed German legal entity name variant is correct","Overriding MANUAL_REVIEW status to PASS"]},
        {id:"step-8",title_p:"Approving PR in SAP Ariba...",title_s:"PR-2026-01045 approved in SAP Ariba with review notes",reasoning:["Status: Approved (with manual review override)","Review notes posted as comment","Validation details archived"]},
        {id:"step-9",title_p:"Finalizing audit trail...",title_s:"Process complete - PR-2026-01045 approved after manual review",reasoning:["Manual review completed by human reviewer","PR approved in SAP Ariba","Full audit trail with review decision logged","Processing duration: 1m 15s (including review wait)"]}
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
        updateProcessLog(PROCESS_ID, { id: step.id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), title: step.title_p, status: 'processing' });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);

        if (step.id === "step-6") {
            updateProcessLog(PROCESS_ID, { id: step.id, title: step.title_s, status: 'warning', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
            await updateProcessListStatus(PROCESS_ID, 'Needs Attention', step.title_s);
            await waitForSignal("APPROVE_MANUAL_REVIEW");
            await updateProcessListStatus(PROCESS_ID, 'In Progress', 'Manual review approved');
        } else {
            updateProcessLog(PROCESS_ID, { id: step.id, title: step.title_s, status: isFinal ? 'completed' : 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
            await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
            await delay(1500);
        }
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
