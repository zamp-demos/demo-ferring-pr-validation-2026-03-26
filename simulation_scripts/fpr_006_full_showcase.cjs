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

// Per-process HITL: polls /hitl/FPR_006
const waitForHITL = async () => {
    console.log("FPR_006: Waiting for HITL action (send or reject)...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    // Set this process HITL state to pending
    try {
        await fetch(`${API_URL}/hitl/FPR_006`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pending: true, action: null })
        });
    } catch (e) { console.error('FPR_006: Failed to set HITL pending:', e.message); }

    // Legacy compat
    try { await fetch(`${API_URL}/email-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent: false }) }); } catch (e) {}

    while (true) {
        await delay(2000);
        try {
            const response = await fetch(`${API_URL}/hitl/FPR_006`);
            if (response.ok) {
                const { action } = await response.json();
                if (action === 'send') { console.log("FPR_006: Email approved - sending!"); return 'send'; }
                if (action === 'reject') { console.log("FPR_006: Reviewer rejected process."); return 'reject'; }
            }
        } catch (e) { }
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);
    const steps = [
        // STEP 1: Desktop agent connects to SAP Ariba
        {
            id:"step-1",
            title_p:"Desktop agent connecting to SAP Ariba...",
            title_s:"SAP Ariba session established - navigating to PR-2026-01567",
            reasoning:[
                "Agent authenticated as pace.agent@ferring.com",
                "Session ID: SESS-2026-03-26-0847",
                "Navigated to Pending Approvals queue",
                "Located PR-2026-01567 in queue (Position 3 of 12 pending items)",
                "Desktop agent actions logged for full audit trail",
                "All UI interactions recorded via screen capture"
            ],
            artifacts:[
                {id:"v-ariba-6",type:"video",label:"Desktop Agent: SAP Ariba Login & Queue",videoPath:"/data/sap_ariba_desktop_agent_fpr006.webm"},
                {id:"sess-log-6",type:"json",label:"Desktop Agent Session Log",data:{session_id:"SESS-2026-03-26-0847",agent:"pace.agent@ferring.com",login_time:"10:14:18",system:"SAP Ariba Procurement",actions:[{ts:"10:14:18",action:"Launch SAP Ariba desktop client",status:"Success"},{ts:"10:14:21",action:"Authenticate as pace.agent@ferring.com",status:"Success"},{ts:"10:14:23",action:"Navigate to Pending Approvals queue",status:"Success"},{ts:"10:14:25",action:"Locate PR-2026-01567 (position 3 of 12)",status:"Found"}]}}
            ]
        },

        // STEP 2: Agent opens PR-2026-01567, reads each field
        {
            id:"step-2",
            title_p:"Opening PR-2026-01567 and reading all header fields...",
            title_s:"PR header extracted - Boehringer Ingelheim, EUR 2,780,000 (US entity)",
            reasoning:[
                "Agent clicked on PR-2026-01567 in the queue list",
                "Agent scrolled through the PR header section",
                "Read Company Code = 4100 (Ferring Pharmaceuticals Inc., USA)",
                "Read Requester: Dr. Robert Kingsley",
                "Read Budget Owner: Sarah Whitfield, VP Manufacturing",
                "Read PO Owner: Dr. Robert Kingsley",
                "Read Cost Center: CC-MFG-US-007",
                "Read Currency: EUR",
                "Read Total Amount: EUR 2,780,000.00",
                "Read Preferred Ordering: PRINTING",
                "Read Comments: 'project site address - new manufacturing facility'",
                "Read Supplier: Boehringer Ingelheim (ID: SUP-BI-4477)"
            ],
            artifacts:[
                {id:"pr-header-6",type:"json",label:"PR Header - Extracted Fields",data:{pr_id:"PR-2026-01567",company_code:"4100",entity:"Ferring Pharmaceuticals Inc.",requester:"Dr. Robert Kingsley",budget_owner:"Sarah Whitfield, VP Manufacturing",po_owner:"Dr. Robert Kingsley",cost_center:"CC-MFG-US-007",currency:"EUR",total_amount:"2,780,000.00",preferred_ordering:"PRINTING",comments:"project site address - new manufacturing facility",supplier:"Boehringer Ingelheim",supplier_id:"SUP-BI-4477",region:"US/Canada",document_type:"MSA + SOW",attachments_count:2}}
            ]
        },

        // STEP 3: Agent opens each line item (3 line items)
        {
            id:"step-3",
            title_p:"Opening and extracting all line items...",
            title_s:"3 line items extracted - Bioprocess, Technology Transfer, Regulatory Support",
            reasoning:[
                "Agent opened Line Item 1: Bioprocess Development Services",
                "Read Item 1: Material Code MG-MFG-001, Qty 1, Unit Price EUR 1,500,000.00",
                "Agent opened Line Item 2: Technology Transfer Services",
                "Read Item 2: Material Code MG-TT-003, Qty 1, Unit Price EUR 800,000.00",
                "Agent opened Line Item 3: Regulatory Affairs Support",
                "Read Item 3: Material Code MG-REG-007, Qty 1, Unit Price EUR 480,000.00",
                "Line item total: EUR 2,780,000.00 - matches PR header total",
                "All 3 line items use EUR currency - consistent"
            ],
            artifacts:[
                {id:"line-items-6",type:"json",label:"Line Items - All 3 Extracted",data:{pr_id:"PR-2026-01567",total_line_items:3,currency:"EUR",grand_total:"2,780,000.00",items:[{item_no:"1",description:"Bioprocess Development Services",material_code:"MG-MFG-001",quantity:1,unit_price:"1,500,000.00",total:"1,500,000.00"},{item_no:"2",description:"Technology Transfer Services",material_code:"MG-TT-003",quantity:1,unit_price:"800,000.00",total:"800,000.00"},{item_no:"3",description:"Regulatory Affairs Support",material_code:"MG-REG-007",quantity:1,unit_price:"480,000.00",total:"480,000.00"}]}}
            ]
        },

        // STEP 4: Agent downloads attachments
        {
            id:"step-4",
            title_p:"Downloading 2 attachments from SAP Ariba PR-2026-01567...",
            title_s:"Validation 1/14: MSA (0.93) + SOW (0.90) identified - both downloaded",
            reasoning:[
                "Found 2 attachments on PR-2026-01567",
                "Downloading BI_MSA_Ferring_2026.pdf (12 pages, 1.8MB)",
                "Download complete: BI_MSA_Ferring_2026.pdf saved to processing folder",
                "Downloading BI_SOW_Manufacturing_2026.pdf (6 pages, 892KB)",
                "Download complete: BI_SOW_Manufacturing_2026.pdf saved to processing folder",
                "Document classification: MSA (confidence 0.93), SOW (confidence 0.90)",
                "Priority selection: MSA takes precedence per document priority ruleset (MSA > SOW > Quotation > Invoice > PO)"
            ],
            artifacts:[
                {id:"pdf-msa-6",type:"file",label:"MSA - Boehringer Ingelheim",pdfPath:"/data/boehringer_msa_2026.pdf"},
                {id:"pdf-sow-6",type:"file",label:"SOW - Boehringer Ingelheim",pdfPath:"/data/boehringer_sow_2026.pdf"},
                {id:"doc-class-6",type:"json",label:"Document Classification Results",data:{documents:[{filename:"BI_MSA_Ferring_2026.pdf",type:"Master Service Agreement",confidence:0.93,pages:12,size_kb:1843,selected_for_primary_validation:true},{filename:"BI_SOW_Manufacturing_2026.pdf",type:"Statement of Work",confidence:0.90,pages:6,size_kb:892,selected_for_primary_validation:false}]}}
            ]
        },

        // STEP 5: Extract structured data from MSA
        {
            id:"step-5",
            title_p:"Extracting structured data from MSA (12 pages)...",
            title_s:"MSA fully parsed - max contract value EUR 2,500,000 identified",
            reasoning:[
                "Read MSA page 1: Parties identified",
                "Extracted: Supplier = 'Boehringer Ingelheim Pharma GmbH & Co. KG'",
                "Extracted: Customer = 'Ferring Pharmaceuticals Inc.'",
                "Read MSA page 2-3: Contract terms",
                "Extracted: Contract Number = MSA-BI-2024-0047",
                "Extracted: Maximum Contract Value = EUR 2,500,000.00",
                "Extracted: Effective Date = 2024-01-01",
                "Extracted: Expiry Date = 2027-12-31",
                "Read MSA page 4-6: Service scope",
                "Extracted: Service Type = Contract Pharmaceutical Manufacturing",
                "Extracted: Payment Terms = NET 60",
                "Extracted: Governing Law = State of New Jersey, USA",
                "Read MSA pages 7-12: Schedules, signatures confirmed"
            ],
            artifacts:[
                {id:"msa-data-6",type:"json",label:"MSA Extracted Data",data:{contract_number:"MSA-BI-2024-0047",supplier_name:"Boehringer Ingelheim Pharma GmbH & Co. KG",customer_name:"Ferring Pharmaceuticals Inc.",max_contract_value:"EUR 2,500,000.00",effective_date:"2024-01-01",expiry_date:"2027-12-31",service_type:"Contract Pharmaceutical Manufacturing",payment_terms:"NET 60",governing_law:"State of New Jersey, USA",signed:true,pages_processed:12}}
            ]
        },

        // STEP 6: Extract from SOW
        {
            id:"step-6",
            title_p:"Extracting structured data from SOW (6 pages)...",
            title_s:"SOW parsed - 3 work packages mapped to line items",
            reasoning:[
                "Read SOW page 1: Project scope overview",
                "Extracted: Project = 'Desmopressin API Manufacturing Scale-Up'",
                "Extracted: SOW reference = SOW-BI-2026-MFG-001",
                "Read SOW page 2-3: Work packages",
                "Extracted: Work Package 1 = Bioprocess Development (EUR 1,500,000)",
                "Extracted: Work Package 2 = Technology Transfer (EUR 800,000)",
                "Extracted: Work Package 3 = Regulatory Affairs Support (EUR 480,000)",
                "SOW Total: EUR 2,780,000.00",
                "Read SOW page 4-5: Deliverables and timelines",
                "Extracted: Delivery timeline = 18 months from SOW execution",
                "Extracted: Milestone payments = Yes (4 milestones)"
            ],
            artifacts:[
                {id:"sow-data-6",type:"json",label:"SOW Extracted Data",data:{sow_ref:"SOW-BI-2026-MFG-001",project:"Desmopressin API Manufacturing Scale-Up",work_packages:[{id:"WP-1",name:"Bioprocess Development Services",value:"EUR 1,500,000.00"},{id:"WP-2",name:"Technology Transfer Services",value:"EUR 800,000.00"},{id:"WP-3",name:"Regulatory Affairs Support",value:"EUR 480,000.00"}],sow_total:"EUR 2,780,000.00",delivery_timeline:"18 months",milestone_payments:4}}
            ]
        },

        // STEP 7: Categorise and V1-V9 validations
        {
            id:"step-7",
            title_p:"Running comprehensive validation suite (14 domains)...",
            title_s:"Validations V1-V9: 6 PASS, Pricing FAIL (MSA cap exceeded by EUR 280,000), 2 with flags",
            reasoning:[
                "V1 Attachment: MSA + SOW both valid - PASS",
                "V2 Accounting: Cost Center CC-MFG-US-007, GL assignment consistent with manufacturing - PASS",
                "V3 Budget Owner: Sarah Whitfield != Dr. Robert Kingsley (requester) - independent approval confirmed - PASS",
                "V4 Currency: EUR consistent across PR header, all 3 line items, and MSA - PASS",
                "V5 Material Group: MG-MFG-001, MG-TT-003, MG-REG-007 all found in approved master list - PASS",
                "V6 Supplier: 'Boehringer Ingelheim Pharma GmbH & Co. KG' vs 'Boehringer Ingelheim' - 95% match - PASS",
                "V7 Pricing: FAIL - PR total EUR 2,780,000 exceeds MSA maximum EUR 2,500,000 by EUR 280,000 (11.2%)",
                "V8 Service Type: Contract Manufacturing - 0.89 match confidence - PASS",
                "V9 Ordering: PRINTING method detected - PASS but flag: Ferring PO Distribution Group should be added as approver"
            ],
            artifacts:[
                {id:"price-6",type:"json",label:"Pricing Validation - MSA Cap Exceeded",data:{pr_total:"EUR 2,780,000.00",msa_max_value:"EUR 2,500,000.00",exceeded_by:"EUR 280,000.00",exceeded_pct:"11.2%",status:"FAIL",note:"PR amount exceeds maximum contract value defined in MSA. MSA amendment or reduced PR required."}}
            ]
        },

        // STEP 8: V10-V14 and validation summary
        {
            id:"step-8",
            title_p:"Completing validations V10-V14 and generating summary...",
            title_s:"Overall: FAIL - 11 PASS, 1 FAIL (MSA cap), 2 informational flags",
            reasoning:[
                "V10 Ship-To: SHIP-US-001 valid; flag: comment mentions 'new manufacturing facility' - may need new Ship-To record",
                "V11 Sold-To: Company code 4100 = 4100 - PASS",
                "V12 Company Code: Ferring Pharmaceuticals Inc. - confidence 0.99 - PASS",
                "V13 Quantity: Match at Level 2 - PASS",
                "V14 Deliver-To: Valid content - PASS",
                "SUMMARY: 11 PASS | 1 FAIL | 2 informational notes",
                "Critical failure: PR EUR 2,780,000 exceeds MSA cap EUR 2,500,000 by EUR 280,000 (11.2%)",
                "Action required: MSA amendment OR PR reduction below EUR 2,500,000"
            ],
            artifacts:[
                {id:"val-6",type:"json",label:"Complete Validation Scorecard",data:{overall_status:"FAIL",passed:11,failed:1,manual_review:0,notes:2,key_issues:["V7 Pricing: PR EUR 2,780,000 exceeds MSA cap EUR 2,500,000 by EUR 280,000 (11.2%) - FAIL","V9 Ordering: PRINTING method - Ferring PO Distribution Group approver needed","V10 Ship-To: New manufacturing facility address may require new Ship-To record"],complete_audit:{v1_attachment:"PASS",v2_accounting:"PASS",v3_budget_owner:"PASS",v4_currency:"PASS",v5_material_group:"PASS",v6_supplier_id:"PASS (95%)",v7_pricing:"FAIL",v8_service_type:"PASS (0.89)",v9_ordering_method:"PASS (with note)",v10_ship_to:"PASS (with note)",v11_sold_to:"PASS",v12_company_code:"PASS (0.99)",v13_quantity:"PASS",v14_deliver_to:"PASS"}}}
            ]
        },

        // STEP 9: HITL - draft email, wait for approval
        {
            id:"step-9",
            hitl:"email",
            title_p:"Drafting rejection email to supplier and requester...",
            title_s:"Email draft ready - awaiting procurement team approval to send",
            reasoning:[
                "Comprehensive rejection email prepared",
                "To: contracts@boehringer-ingelheim.com, robert.kingsley@ferring.com",
                "CC: procurement-us@ferring.com, sarah.whitfield@ferring.com",
                "Email covers: MSA cap exceedance (primary), ordering method flag, special delivery note",
                "Requested actions: MSA amendment OR reduced PR + Ship-To confirmation",
                "Draft reviewed by Pace - awaiting human procurement team approval"
            ],
            artifacts:[
                {id:"email-6",type:"email_draft",label:"Email: PR Rejection - MSA Cap Exceeded",data:{isIncoming:false,to:"contracts@boehringer-ingelheim.com, robert.kingsley@ferring.com",cc:"procurement-us@ferring.com, sarah.whitfield@ferring.com, validation-team@ferring.com",subject:"Action Required: Purchase Requisition PR-2026-01567 - MSA Maximum Value Exceeded",body:"Dear Dr. Kingsley and Boehringer Ingelheim Contracts Team,\n\nRegarding Purchase Requisition: PR-2026-01567\n\nDuring automated validation of your PR (Boehringer Ingelheim, EUR 2,780,000.00), the following critical issue was identified:\n\n1. MSA MAXIMUM CONTRACT VALUE EXCEEDED (Critical):\n   - PR Amount: EUR 2,780,000.00\n   - MSA Maximum Contract Value: EUR 2,500,000.00 (MSA-BI-2024-0047)\n   - Excess Amount: EUR 280,000.00 (11.2% over cap)\n   The PR amount exceeds the maximum contract value defined in the Master Service Agreement. An MSA amendment or reduction in PR scope is required before this PR can be approved.\n\n2. ORDERING METHOD NOTE (Informational):\n   - Preferred ordering method is PRINTING\n   - Ferring PO Distribution Group should be added as approver for manual PO distribution\n\n3. SPECIAL DELIVERY REQUEST (Informational):\n   - Comment detected: 'project site address - new manufacturing facility'\n   - A new Ship-To address record may need to be created for the manufacturing facility\n\nRequired Actions:\n- Option A: Initiate MSA amendment to increase maximum contract value above EUR 2,780,000, OR\n- Option B: Reduce PR total to within MSA cap (EUR 2,500,000.00)\n- Confirm new manufacturing facility Ship-To address details\n\nPlease respond within 5 business days.\n\nBest regards,\nFerring Procurement Validation Team\nvalidation-team@ferring.com"}}
            ]
        },

        // STEP 10: After HITL send - Agent goes BACK to SAP Ariba, rejects PR
        {
            id:"step-10",
            title_p:"Desktop agent returning to SAP Ariba to reject PR-2026-01567...",
            title_s:"PR-2026-01567 status changed to REJECTED in SAP Ariba",
            reasoning:[
                "Desktop agent re-authenticated to SAP Ariba (session refresh)",
                "Navigated to PR-2026-01567",
                "Selected 'Reject' action from approver dropdown menu",
                "Added rejection comment: 'PR exceeds MSA maximum contract value (MSA-BI-2024-0047) by EUR 280,000 (11.2%). MSA amendment or PR reduction required. See email sent to requestor and supplier.'",
                "Submitted rejection - confirmation received",
                "Status before: Pending Approval",
                "Status after: Rejected",
                "Rejection timestamp: confirmed by system (200 OK response)"
            ],
            artifacts:[
                {id:"v-reject-6",type:"video",label:"Desktop Agent: SAP Ariba Rejection",videoPath:"/data/sap_ariba_rejection_fpr006.webm"},
                {id:"ariba-reject-6",type:"json",label:"SAP Ariba Rejection Confirmation",data:{pr_id:"PR-2026-01567",action:"REJECT",status_before:"Pending Approval",status_after:"Rejected",rejection_comment:"PR exceeds MSA maximum contract value (MSA-BI-2024-0047) by EUR 280,000 (11.2%). MSA amendment or PR reduction required. Rejection email sent to contracts@boehringer-ingelheim.com and robert.kingsley@ferring.com.",timestamp:"2026-03-26T10:22:31Z",confirmed_by:"Pace Automation Agent",system_response:"200 OK"}}
            ]
        },

        // STEP 11: Receive vendor confirmation email (incoming)
        {
            id:"step-11",
            title_p:"Polling vendor email inbox for confirmation...",
            title_s:"Vendor confirmation received - Boehringer acknowledges MSA cap issue",
            reasoning:[
                "Polling ferring-procurement@ferring.com inbox for reply...",
                "Received reply from contracts@boehringer-ingelheim.com",
                "Email subject: RE: Action Required: Purchase Requisition PR-2026-01567",
                "Email received: 2026-03-26T10:45:22Z (23 minutes after outbound)",
                "Extracted: Vendor acknowledges MSA cap exceedance",
                "Extracted: Boehringer commits to filing MSA amendment within 10 business days",
                "Extracted: Vendor will resubmit PR after amendment executed",
                "Sentiment: Cooperative - no escalation required"
            ],
            artifacts:[
                {id:"vendor-reply-6",type:"email_draft",label:"Incoming: Vendor Confirmation from Boehringer",data:{isIncoming:true,from:"contracts@boehringer-ingelheim.com",to:"validation-team@ferring.com, robert.kingsley@ferring.com",subject:"RE: Action Required: Purchase Requisition PR-2026-01567 - MSA Maximum Value Exceeded",received:"2026-03-26T10:45:22Z",body:"Dear Ferring Procurement Team,\n\nThank you for the automated validation notification regarding PR-2026-01567.\n\nWe acknowledge that the PR total of EUR 2,780,000 exceeds the current MSA maximum contract value of EUR 2,500,000 under agreement MSA-BI-2024-0047.\n\nBoehringer Ingelheim will:\n1. Initiate an MSA amendment (Amendment 001 to MSA-BI-2024-0047) to increase the maximum contract value to EUR 3,000,000 to accommodate the full project scope\n2. Target completion of the amendment within 10 business days\n3. Resubmit the PR once the amended MSA is executed by both parties\n\nWe will copy robert.kingsley@ferring.com and sarah.whitfield@ferring.com on the amendment documentation.\n\nBest regards,\nContracts Team\nBoehringer Ingelheim Pharma GmbH & Co. KG\ncontracts@boehringer-ingelheim.com"}}
            ]
        },

        // STEP 12: Update SAP Ariba with vendor response
        {
            id:"step-12",
            title_p:"Updating PR-2026-01567 in SAP Ariba with vendor response...",
            title_s:"SAP Ariba PR updated - vendor response logged, follow-up flag set",
            reasoning:[
                "Desktop agent accessed PR-2026-01567 in SAP Ariba",
                "Added note to PR: 'Vendor (Boehringer Ingelheim) acknowledged MSA cap issue. MSA Amendment 001 initiated - target 10 business days. PR to be resubmitted post-amendment execution.'",
                "Set follow-up flag on PR for MSA amendment tracking",
                "Added reminder: review on 2026-04-09 (10 business days)",
                "All vendor communication archived against PR record"
            ],
            artifacts:[
                {id:"v-update-6",type:"video",label:"Desktop Agent: SAP Ariba PR Update",videoPath:"/data/sap_ariba_desktop_agent_fpr006.webm"},
                {id:"ariba-update-6",type:"json",label:"SAP Ariba PR Update Confirmation",data:{pr_id:"PR-2026-01567",action:"ADD_NOTE",note:"Vendor (Boehringer Ingelheim) acknowledged MSA cap issue via email 2026-03-26T10:45:22Z. MSA Amendment 001 to MSA-BI-2024-0047 initiated - target completion 10 business days (by 2026-04-09). PR to be resubmitted post-amendment.",follow_up_date:"2026-04-09",follow_up_flag:true,timestamp:"2026-03-26T10:51:03Z"}}
            ]
        },

        // STEP 13: Update ServiceNow ticket
        {
            id:"step-13",
            title_p:"Updating ServiceNow ticket INC-2026-05102 with full resolution...",
            title_s:"ServiceNow ticket resolved - complete audit trail linked",
            reasoning:[
                "Desktop agent logged into ServiceNow portal",
                "Located ticket INC-2026-05102 (linked to PR-2026-01567)",
                "Updated ticket status: Open → Resolved",
                "Added resolution note with full validation summary",
                "Linked SAP Ariba rejection confirmation",
                "Linked vendor email confirmation",
                "Set follow-up task for MSA amendment review on 2026-04-09",
                "Ticket closed with Category: PR Validation Failure - MSA Cap Exceeded"
            ],
            artifacts:[
                {id:"v-snow-6",type:"video",label:"Desktop Agent: ServiceNow Ticket Update",videoPath:"/data/servicenow_fpr006.webm"},
                {id:"snow-update-6",type:"json",label:"ServiceNow Ticket Resolution",data:{ticket_id:"INC-2026-05102",status_before:"Open",status_after:"Resolved",category:"PR Validation Failure - MSA Cap Exceeded",resolution_summary:"PR-2026-01567 rejected: PR total EUR 2,780,000 exceeds MSA-BI-2024-0047 maximum EUR 2,500,000 by EUR 280,000 (11.2%). Rejection email sent to vendor and requester. Vendor confirmed MSA amendment in progress (target 10 business days). PR to be resubmitted post-amendment.",validations_run:14,validations_passed:11,validations_failed:1,follow_up_date:"2026-04-09",resolved_timestamp:"2026-03-26T10:55:17Z"}}
            ]
        },

        // STEP 14: Final audit trail
        {
            id:"step-14",
            title_p:"Generating complete end-to-end audit trail...",
            title_s:"FPR-006 complete - all 11 capabilities demonstrated, full audit archived",
            reasoning:[
                "Complete audit trail generated covering all process steps",
                "ServiceNow ticket → SAP Ariba retrieval → Header extraction → Line item extraction → Attachment download → MSA parsing → SOW parsing → 14-domain validation → HITL email approval → SAP Ariba rejection → Vendor reply received → SAP Ariba PR update → ServiceNow resolution",
                "Desktop agent actions: 14 logged interactions",
                "Documents processed: 2 (MSA + SOW)",
                "Validations run: 14 across all domains",
                "Human-in-the-loop: 1 email approval gate",
                "Total processing duration: 41 minutes (including HITL wait)",
                "All artifacts preserved for compliance and audit review"
            ],
            artifacts:[
                {id:"full-audit-6",type:"json",label:"Complete End-to-End Audit Trail",data:{process_id:"FPR_006",case_name:"Full Pace Capabilities Showcase",pr_id:"PR-2026-01567",servicenow_ticket:"INC-2026-05102",supplier:"Boehringer Ingelheim Pharma GmbH & Co. KG",pr_amount:"EUR 2,780,000.00",msa_cap:"EUR 2,500,000.00",outcome:"REJECTED - MSA cap exceeded",capabilities_demonstrated:["Desktop SAP Ariba agent","PR header field extraction","Line item extraction (3 items)","Multi-document attachment download","MSA structured data extraction","SOW structured data extraction","14-domain validation suite","HITL email approval gate","SAP Ariba rejection via desktop agent","Vendor email inbox monitoring","Incoming email parsing and confirmation extraction","SAP Ariba PR update with vendor response","ServiceNow ticket resolution","Complete audit trail generation"],total_steps:14,documents_processed:2,validations_run:14,validations_passed:11,validations_failed:1,hitl_gates:1,desktop_agent_interactions:14,vendor_reply_received:true,msa_amendment_committed:true,follow_up_date:"2026-04-09",audit_complete:true}}
            ]
        }
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
                updateProcessLog(PROCESS_ID, { id: step.id, title: 'Email sent - proceeding with SAP Ariba rejection', status: 'success', reasoning: step.reasoning || [], artifacts: step.artifacts || [] });
                await updateProcessListStatus(PROCESS_ID, 'In Progress', 'Email approved and sent - updating SAP Ariba');
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
