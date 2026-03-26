const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_005";
const CASE_NAME = "US ServiceNow Flow";

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
        {id:"step-1",title_p:"Desktop agent connecting to ServiceNow...",title_s:"ServiceNow ticket INC-2026-04521 picked up",reasoning:["Agent logged into ServiceNow portal","Navigated to My Assigned Tickets queue","Found ticket INC-2026-04521 - Priority: Medium","Ticket linked to PR-2026-01203","Status changed: New -> In Progress"],artifacts:[{id:"v-snow-5",type:"video",label:"Desktop Agent: ServiceNow Ticket",videoPath:"/data/servicenow_ticket_fpr005.webm"},{id:"snow-5",type:"json",label:"ServiceNow Ticket Details",data:{ticket_id:"INC-2026-04521",pr_id:"PR-2026-01203",priority:"Medium",category:"Procurement",requester:"Jennifer Martinez",company_code:"4100",status:"In Progress"}}]},
        {id:"step-2",title_p:"Extracting PR ID from ServiceNow ticket...",title_s:"PR ID PR-2026-01203 extracted - connecting to SAP Ariba",reasoning:["PR ID: PR-2026-01203 extracted from ticket description","Switching to SAP Ariba to fetch full PR details"]},
        {id:"step-3",title_p:"Desktop agent navigating SAP Ariba for PR details...",title_s:"PR-2026-01203 retrieved from SAP Ariba",reasoning:["Authenticated to SAP Ariba","PR fetched: Thermo Fisher Scientific","Company Code: 4100 (Ferring Pharmaceuticals Inc., USA)","Amount: USD 67,850.00","4 line items for laboratory equipment"],artifacts:[{id:"v-ariba-5",type:"video",label:"Desktop Agent: SAP Ariba PR Retrieval",videoPath:"/data/sap_ariba_pr_fpr005.webm"},{id:"pr-5",type:"json",label:"PR Header Data",data:{pr_id:"PR-2026-01203",company_code:"4100",entity:"Ferring Pharmaceuticals Inc.",requester:"Jennifer Martinez",supplier:"Thermo Fisher Scientific",currency:"USD",total_amount:"67,850.00",line_items:4}}]},
        {id:"step-4",title_p:"Extracting line items and enriching supplier data...",title_s:"4 line items extracted - Thermo Fisher validated in supplier master",reasoning:["Line 1: Analytical Balance (0.1mg) - USD 12,500.00","Line 2: Centrifuge (high-speed) - USD 28,750.00","Line 3: Pipette Set (multi-channel) - USD 8,600.00","Line 4: Spectrophotometer UV-Vis - USD 18,000.00","Supplier: Thermo Fisher Scientific Inc. (ID: SUP-10245)","No blocks, payment terms: NET 30"]},
        {id:"step-5",title_p:"Downloading and classifying PO attachment...",title_s:"Validation 1/14: Purchase Order identified (confidence: 0.91)",reasoning:["Downloaded: ThermoFisher_PO_2026_01203.pdf (2 pages)","Document type: Purchase Order (confidence 0.91)","PO Date: 2026-03-18","Delivery Date: 2026-04-15"],artifacts:[{id:"pdf-5",type:"file",label:"PO - Thermo Fisher Scientific",pdfPath:"/data/thermo_fisher_po_2026.pdf"}]},
        {id:"step-6",title_p:"Extracting structured data and running validations 2-7...",title_s:"Data extracted - Validations 2-7 all PASS",reasoning:["Document total: USD 67,850.00 matches PR total exactly","Supplier: Thermo Fisher Scientific Inc. - 98% match - PASS","Currency: USD consistent across document and all line items","Accounting: Assignment K, Cost Center CC-US-LAB-001 - consistent","Material Group: MG-EQP-001 in master with GL 21400200 - PASS","Budget Owner: Dr. Michael Torres != Jennifer Martinez - PASS"]},
        {id:"step-7",title_p:"Running validations 8-14...",title_s:"Validations 8-14 all PASS - clean validation sweep",reasoning:["V8 Service Type: HSN codes valid for equipment - PASS","V9 Ordering: EMAIL, orders@thermofisher.com valid - PASS","V10 Ship-To: SHIP-US-001 (Parsippany facility) linked to 4100 - PASS","V11 Sold-To: 4100 = 4100, verified - PASS","V12 Company Code: Ferring Pharmaceuticals Inc. - confidence 0.99 - PASS","V13 Quantity: All 4 items match individually - PASS","V14 Deliver-To: Ferring Labs, 100 Interpace Pkwy, Parsippany - PASS"]},
        {id:"step-8",title_p:"Generating validation summary...",title_s:"Overall status: PASS - 14/14 validations passed",reasoning:["All validations passed with high confidence","No issues detected","Recommendation: Auto-approve"],artifacts:[{id:"val-5",type:"json",label:"Validation Summary",data:{overall_status:"PASS",passed:14,failed:0,manual_review:0}}]},
        {id:"step-9",title_p:"Approving PR in SAP Ariba...",title_s:"PR-2026-01203 approved in SAP Ariba",reasoning:["Status: Approved","Approval comment posted with validation summary","No email required"]},
        {id:"step-10",title_p:"Updating ServiceNow ticket...",title_s:"ServiceNow ticket INC-2026-04521 resolved",reasoning:["Ticket status: Resolved","Resolution notes: PR auto-approved, all 14 validations passed","Validation summary attached to ticket","Link to PR in SAP Ariba included"],artifacts:[{id:"snow-resolve-5",type:"json",label:"ServiceNow Update",data:{ticket_id:"INC-2026-04521",new_status:"Resolved",resolution:"PR-2026-01203 auto-approved. All 14 validations passed.",pr_link:"https://ferring.ariba.com/pr/PR-2026-01203"}}]},
        {id:"step-11",title_p:"Finalizing audit trail...",title_s:"Process complete - PR-2026-01203 approved via ServiceNow flow",reasoning:["End-to-end ServiceNow + SAP Ariba flow completed","PR approved, ticket resolved","Full audit trail archived","Processing duration: 48 seconds"]}
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
        updateProcessLog(PROCESS_ID, { id: step.id, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), title: step.title_p, status: 'processing' });
        await updateProcessListStatus(PROCESS_ID, 'In Progress', step.title_p);
        await delay(2000);
        updateProcessLog(PROCESS_ID, { id: step.id, title: step.title_s, status: isFinal ? 'completed' : 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
        await updateProcessListStatus(PROCESS_ID, isFinal ? 'Done' : 'In Progress', step.title_s);
        await delay(1500);
    }
    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
