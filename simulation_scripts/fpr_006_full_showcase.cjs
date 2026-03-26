const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "FPR_006";
const CASE_NAME = "Full Pace Capabilities Showcase";

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
        {id:"step-1",title_p:"Desktop agent connecting to ServiceNow...",title_s:"ServiceNow ticket INC-2026-05102 picked up",reasoning:["Logged into ServiceNow portal","Ticket INC-2026-05102 assigned to Zamp.ai_test","PR-2026-01567 linked to ticket","Priority: High (contract manufacturing)"],artifacts:[{id:"v-snow-6",type:"video",label:"Desktop Agent: ServiceNow Ticket",videoPath:"/data/servicenow_fpr006.webm"}]},
        {id:"step-2",title_p:"Desktop agent logging into SAP Ariba...",title_s:"SAP Ariba session established - navigating to PR-2026-01567",reasoning:["Agent authenticated as pace.agent@ferring.com","Navigated to Pending Approvals queue","Located PR-2026-01567","Extracting header data and downloading attachments","All desktop agent actions logged for audit"],artifacts:[{id:"v-ariba-6",type:"video",label:"Desktop Agent: SAP Ariba Full Navigation",videoPath:"/data/sap_ariba_desktop_agent_fpr006.webm"},{id:"audit-6",type:"json",label:"Desktop Agent Audit Log",data:{agent_session:"SESS-2026-03-26-0847",actions:[{timestamp:"10:14:21",action:"Connect to SAP Ariba",status:"Success"},{timestamp:"10:14:23",action:"Authenticate",status:"Success"},{timestamp:"10:14:25",action:"Navigate to Pending Approvals",status:"Success"},{timestamp:"10:14:27",action:"Search PR-2026-01567",status:"Found"},{timestamp:"10:14:29",action:"Open PR Details",status:"Success"},{timestamp:"10:14:31",action:"Extract Header Data",status:"Complete"},{timestamp:"10:14:33",action:"Download Attachment 1: MSA",status:"Complete"},{timestamp:"10:14:35",action:"Download Attachment 2: SOW",status:"Complete"}]}}]},
        {id:"step-3",title_p:"Extracting PR data - 2 attachments found...",title_s:"PR data extracted - Boehringer Ingelheim, EUR 2,780,000",reasoning:["Company Code: 4100 (Ferring Pharmaceuticals Inc., USA)","Supplier: Boehringer Ingelheim","Total: EUR 2,780,000.00","2 attachments: MSA (12 pages) + SOW (6 pages)","Region: US/Canada (ServiceNow flow)","Contract manufacturing engagement"],artifacts:[{id:"pr-6",type:"json",label:"PR Header Data",data:{pr_id:"PR-2026-01567",company_code:"4100",entity:"Ferring Pharmaceuticals Inc.",requester:"Dr. Robert Kingsley",budget_owner:"Sarah Whitfield, VP Manufacturing",po_owner:"Dr. Robert Kingsley",supplier:"Boehringer Ingelheim",currency:"EUR",total_amount:"2,780,000.00",preferred_ordering:"PRINTING",comments:"project site address - new manufacturing facility"}}]},
        {id:"step-4",title_p:"Classifying 2 attachments...",title_s:"Validation 1/14: MSA (0.93 confidence) + SOW (0.90 confidence) identified",reasoning:["Attachment 1: BI_MSA_Ferring_2026.pdf - MSA (confidence 0.93)","Attachment 2: BI_SOW_Manufacturing_2026.pdf - SOW (confidence 0.90)","MSA selected as priority document per validation rules","MSA > SOW > Quotation > Invoice > PO in priority order"],artifacts:[{id:"pdf-msa-6",type:"file",label:"MSA - Boehringer Ingelheim",pdfPath:"/data/boehringer_msa_2026.pdf"},{id:"pdf-sow-6",type:"file",label:"SOW - Boehringer Ingelheim",pdfPath:"/data/boehringer_sow_2026.pdf"},{id:"doc-class-6",type:"json",label:"Document Classification",data:{documents:[{filename:"BI_MSA_Ferring_2026.pdf",type:"Master Service Agreement",confidence:0.93,pages:12,selected_for_validation:true},{filename:"BI_SOW_Manufacturing_2026.pdf",type:"Statement of Work",confidence:0.90,pages:6,selected_for_validation:false}]}}]},
        {id:"step-5",title_p:"Extracting structured data from MSA...",title_s:"MSA data extracted - max contract value EUR 2,500,000",reasoning:["Supplier: Boehringer Ingelheim Pharma GmbH & Co. KG","Company: Ferring Pharmaceuticals Inc.","Maximum contract value: EUR 2,500,000.00","Effective: 2026-01-01 to 2028-12-31","Services: Contract pharmaceutical manufacturing","Payment terms: NET 60"],artifacts:[{id:"msa-data-6",type:"json",label:"MSA Extracted Data",data:{supplier_name:"Boehringer Ingelheim Pharma GmbH & Co. KG",company_name:"Ferring Pharmaceuticals Inc.",max_contract_value:"EUR 2,500,000.00",effective_start:"2026-01-01",termination_end:"2028-12-31",service_type:"Contract Pharmaceutical Manufacturing"}}]},
        {id:"step-6",title_p:"Running comprehensive validation suite...",title_s:"Validations 2-9: 6 PASS, Pricing FAIL (MSA cap exceeded), Ordering PASS with flag",reasoning:["V2 Accounting: PASS","V3 Budget: Sarah Whitfield != Dr. Robert Kingsley - PASS","V4 Currency: EUR matches - PASS","V5 Material Group: MG-MFG-001 in master - PASS","V6 Supplier: Boehringer Ingelheim Pharma GmbH & Co. KG vs Boehringer Ingelheim - 95% - PASS","V7 Pricing: FAIL - PR EUR 2,780,000 exceeds MSA cap EUR 2,500,000 by EUR 280,000","V8 Service Type: PASS (0.89 match)","V9 Ordering: PRINTING method - PASS but Ferring PO Distribution Group should be added as approver"],artifacts:[{id:"price-6",type:"json",label:"Pricing Validation - MSA Cap Exceeded",data:{pr_total:"EUR 2,780,000.00",msa_max_value:"EUR 2,500,000.00",exceeded_by:"EUR 280,000.00",exceeded_pct:"11.2%",status:"FAIL",note:"PR amount exceeds maximum contract value defined in MSA"}}]},
        {id:"step-7",title_p:"Completing validations 10-14...",title_s:"V10 Ship-To PASS (special request noted), V11-V14 PASS",reasoning:["V10 Ship-To: SHIP-US-001 valid, but special request in comments: 'project site address - new manufacturing facility'","V11 Sold-To: 4100 = 4100 - PASS","V12 Company Code: Ferring Pharmaceuticals Inc. - confidence 0.99 - PASS","V13 Quantity: Match at Level 2 - PASS","V14 Deliver-To: Valid content - PASS"]},
        {id:"step-8",title_p:"Generating comprehensive validation summary...",title_s:"Overall status: FAIL - PR exceeds MSA maximum contract value",reasoning:["FAIL: Pricing exceeds MSA cap by EUR 280,000 (11.2%)","NOTE: PRINTING ordering method requires Ferring PO Distribution Group approver","NOTE: Special delivery request for new manufacturing facility","11 PASS, 1 FAIL, 2 with informational notes","Action: Draft comprehensive email to supplier AND requester"],artifacts:[{id:"val-6",type:"json",label:"Complete Validation Summary",data:{overall_status:"FAIL",passed:11,failed:1,manual_review:0,notes:2,key_issues:["Pricing: PR EUR 2,780,000 exceeds MSA cap EUR 2,500,000 by EUR 280,000","PRINTING method: Ferring PO Distribution Group approver needed (API unavailable)","Special delivery: New manufacturing facility address requested"],complete_audit:{total_validations:14,attachment:"PASS",accounting:"PASS",budget_owner:"PASS",currency:"PASS",material_group:"PASS",supplier_id:"PASS (95%)",pricing:"FAIL",service_type:"PASS (0.89)",ordering_method:"PASS (with note)",ship_to:"PASS (with note)",sold_to:"PASS",company_code:"PASS (0.99)",quantity:"PASS",deliver_to:"PASS"}}}]},
        {id:"step-9",hitl:"email",title_p:"Drafting comprehensive rejection email...",title_s:"Email draft ready - addressed to supplier and requester",reasoning:["Comprehensive email covering all issues","To: Boehringer Ingelheim + Dr. Robert Kingsley","CC: procurement@ferring.com + Sarah Whitfield","Details MSA cap exceedance, ordering method note, special delivery request"],artifacts:[{id:"email-6",type:"email_draft",label:"Email: PR Rejection - MSA Cap Exceeded",data:{isIncoming:false,to:"contracts@boehringer-ingelheim.com, robert.kingsley@ferring.com",cc:"procurement-us@ferring.com, sarah.whitfield@ferring.com, validation-team@ferring.com",subject:"Action Required: Purchase Requisition PR-2026-01567 - MSA Maximum Value Exceeded",body:"Dear Dr. Kingsley and Boehringer Ingelheim Contracts Team,\n\nRegarding Purchase Requisition: PR-2026-01567\n\nDuring automated validation, the following critical issue was identified:\n\n1. MSA MAXIMUM CONTRACT VALUE EXCEEDED (Critical):\n   - PR Amount: EUR 2,780,000.00\n   - MSA Maximum Value: EUR 2,500,000.00\n   - Excess: EUR 280,000.00 (11.2% over cap)\n   The PR amount exceeds the maximum contract value defined in the Master Service Agreement. An MSA amendment or new agreement is required before this PR can be approved.\n\n2. ORDERING METHOD NOTE (Informational):\n   - Preferred ordering method is PRINTING\n   - Ferring PO Distribution Group should be added as approver for manual PO distribution\n\n3. SPECIAL DELIVERY REQUEST (Informational):\n   - Comment detected: 'project site address - new manufacturing facility'\n   - New Ship-To record may need to be created for the manufacturing facility\n\nRequired Actions:\n- Initiate MSA amendment to increase maximum contract value, OR\n- Reduce PR amount to within MSA cap (EUR 2,500,000.00)\n- Confirm new manufacturing facility Ship-To address\n\nPlease respond within 5 business days.\n\nBest regards,\nFerring Procurement Validation Team"}}]},
        {id:"step-10",title_p:"Desktop agent posting rejection to SAP Ariba...",title_s:"PR-2026-01567 rejected in SAP Ariba with full reasoning",reasoning:["Rejection comment posted via desktop agent","Comment includes: MSA cap exceeded, ordering method flag, special delivery note","All validation details included in comment"],artifacts:[{id:"v-reject-6",type:"video",label:"Desktop Agent: SAP Ariba Rejection",videoPath:"/data/sap_ariba_rejection_fpr006.webm"}]},
        {id:"step-11",title_p:"Updating ServiceNow ticket with results...",title_s:"ServiceNow ticket INC-2026-05102 updated with rejection details",reasoning:["Ticket status: Resolved","Resolution: PR rejected - MSA cap exceeded by EUR 280,000","Full validation summary attached","Link to PR in SAP Ariba included"],artifacts:[{id:"snow-6",type:"json",label:"ServiceNow Ticket Update",data:{ticket_id:"INC-2026-05102",status:"Resolved",resolution:"PR-2026-01567 rejected. MSA max value EUR 2,500,000 exceeded by EUR 280,000.",validation_summary:"11 pass, 1 fail, 2 informational notes"}}]},
        {id:"step-12",title_p:"Generating complete audit trail...",title_s:"Process complete - full audit trail generated with all evidence",reasoning:["Complete end-to-end audit trail archived","ServiceNow ticket -> SAP Ariba retrieval -> Document analysis -> 14 validations -> Email -> Rejection -> Ticket update","Desktop agent actions: 8 logged steps","Total processing duration: 1m 28s","All artifacts preserved for compliance review"],artifacts:[{id:"full-audit-6",type:"json",label:"Complete Audit Trail",data:{process_id:"FPR_006",pr_id:"PR-2026-01567",servicenow_ticket:"INC-2026-05102",total_duration_seconds:88,desktop_agent_actions:8,documents_processed:2,validations_run:14,validations_passed:11,validations_failed:1,email_sent:true,sap_action:"REJECTED",servicenow_status:"Resolved",artifacts_archived:["MSA PDF","SOW PDF","Validation reports","Email draft","Desktop agent logs","ServiceNow updates"]}}]}
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
