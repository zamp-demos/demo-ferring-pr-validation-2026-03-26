try { require('dotenv').config(); } catch(e) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
// GoogleGenerativeAI loaded lazily inside callGemini

const PORT = process.env.PORT || 3001;

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const KB_FILE = path.join(__dirname, 'src', 'data', 'knowledgeBase.md');
const FEEDBACK_QUEUE_PATH = path.join(DATA_DIR, 'feedbackQueue.json');
const KB_VERSIONS_PATH = path.join(DATA_DIR, 'kbVersions.json');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

let state = { sent: false, confirmed: false, signals: {} };
const runningProcesses = new Map();

// Startup initialization
try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    const srcDataDir = path.join(__dirname, 'src', 'data');
    if (!fs.existsSync(srcDataDir)) fs.mkdirSync(srcDataDir, { recursive: true });
    if (!fs.existsSync(path.join(DATA_DIR, 'processes.json'))) {
        const base = path.join(DATA_DIR, 'base_processes.json');
        if (fs.existsSync(base)) fs.copyFileSync(base, path.join(DATA_DIR, 'processes.json'));
        else fs.writeFileSync(path.join(DATA_DIR, 'processes.json'), '[]');
    }
    const signalFile = path.join(__dirname, 'interaction-signals.json');
    if (!fs.existsSync(signalFile)) {
        fs.writeFileSync(signalFile, JSON.stringify({ APPROVE_MANUAL_REVIEW: false, APPROVE_EXCEPTION: false }, null, 4));
    }
    if (!fs.existsSync(FEEDBACK_QUEUE_PATH)) fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
    if (!fs.existsSync(KB_VERSIONS_PATH)) fs.writeFileSync(KB_VERSIONS_PATH, '[]');
    if (!fs.existsSync(KB_FILE)) fs.writeFileSync(KB_FILE, '# Ferring PR Validation Knowledge Base\n');
} catch(e) { console.error('Startup init error:', e.message); }
const signalFile = path.join(__dirname, 'interaction-signals.json');

const MIME_TYPES = {
    '.html': 'text/html', '.js': 'application/javascript', '.jsx': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webm': 'video/webm',
    '.pdf': 'application/pdf', '.md': 'text/markdown', '.ico': 'image/x-icon'
};

function serveStatic(req, res, cleanPath) {
    let filePath = path.join(PUBLIC_DIR, cleanPath === '/' ? 'index.html' : cleanPath);
    if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { ...corsHeaders, 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
}

async function callGemini(messages, systemPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.VITE_MODEL || 'gemini-2.5-flash';
    if (!apiKey) return 'Gemini API key not configured.';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
    if (data.candidates && data.candidates[0]) return data.candidates[0].content.parts[0].text;
    return 'Error: ' + JSON.stringify(data);
}


const server = http.createServer(async (req, res) => {
    const cleanPath = req.url.split('?')[0];
    const query = req.url.includes('?') ? req.url.split('?')[1] : '';

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders); res.end(); return;
    }

    // --- GET /reset ---
    if (req.method === 'GET' && cleanPath === '/reset') {
        state = { sent: false, confirmed: false, signals: {} };
        console.log('Demo Reset Triggered');

        fs.writeFileSync(signalFile, JSON.stringify({ APPROVE_MANUAL_REVIEW: false, APPROVE_EXCEPTION: false }, null, 4));

        runningProcesses.forEach((proc) => {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) {}
        });
        runningProcesses.clear();

        exec('pkill -9 -f "node(.*)simulation_scripts" || true', () => {
            setTimeout(() => {
                const processesPath = path.join(DATA_DIR, 'processes.json');
                const cases = [
                    { id: "FPR_001", category: "PR Validation", name: "FPR-001: Standard PR Auto-Approval", stockId: "PR-2026-00847", year: "2026-03-26", status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-00847", supplierName: "Sigma-Aldrich", amount: "CHF 12,450.00", companyCode: "1000", region: "India/ROW", documentType: "Quotation" },
                    { id: "FPR_002", category: "PR Validation", name: "FPR-002: Supplier Mismatch & Pricing Failure", stockId: "PR-2026-00912", year: "2026-03-26", status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-00912", supplierName: "Bachem AG", amount: "USD 45,800.00", companyCode: "2100", region: "India/ROW", documentType: "Invoice" },
                    { id: "FPR_003", category: "PR Validation", name: "FPR-003: Manual Review Required", stockId: "PR-2026-01044", year: "2026-03-26", status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01044", supplierName: "Catalent Pharma Solutions", amount: "EUR 380,000.00", companyCode: "3200", region: "India/ROW", documentType: "SOW" },
                    { id: "FPR_004", category: "PR Validation", name: "FPR-004: No Attachments PR", stockId: "PR-2026-01089", year: "2026-03-26", status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01089", supplierName: "Lonza Group AG", amount: "CHF 95,000.00", companyCode: "1000", region: "India/ROW", documentType: "None" },
                    { id: "FPR_005", category: "PR Validation", name: "FPR-005: US/Canada ServiceNow Flow", stockId: "PR-2026-01203", year: "2026-03-26", status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01203", supplierName: "Thermo Fisher Scientific", amount: "USD 67,850.00", companyCode: "4100", region: "US/Canada", documentType: "PO" },
                    { id: "FPR_006", category: "PR Validation", name: "FPR-006: Full Pace Capabilities Showcase", stockId: "PR-2026-01567", year: "2026-03-26", status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01567", supplierName: "Boehringer Ingelheim", amount: "EUR 2,780,000.00", companyCode: "4100", region: "US/Canada", documentType: "MSA+SOW" }
                ];
                fs.writeFileSync(processesPath, JSON.stringify(cases, null, 4));

                fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
                fs.writeFileSync(KB_VERSIONS_PATH, '[]');

                // Reset individual process files
                cases.forEach(c => {
                    const pf = path.join(DATA_DIR, `process_${c.id}.json`);
                    fs.writeFileSync(pf, JSON.stringify({ logs: [], keyDetails: {}, sidebarArtifacts: [] }, null, 4));
                });

                const scripts = [
                    { file: 'fpr_001_happy_path.cjs', id: 'FPR_001' },
                    { file: 'fpr_002_supplier_mismatch.cjs', id: 'FPR_002' },
                    { file: 'fpr_003_manual_review.cjs', id: 'FPR_003' },
                    { file: 'fpr_004_no_attachments.cjs', id: 'FPR_004' },
                    { file: 'fpr_005_servicenow.cjs', id: 'FPR_005' },
                    { file: 'fpr_006_full_showcase.cjs', id: 'FPR_006' }
                ];

                let totalDelay = 0;
                scripts.forEach((script) => {
                    setTimeout(() => {
                        const scriptPath = path.join(__dirname, 'simulation_scripts', script.file);
                        const child = exec(`node "${scriptPath}" > "${scriptPath}.log" 2>&1`, (error) => {
                            if (error && error.code !== 0) console.error(`${script.file} error:`, error.message);
                            runningProcesses.delete(script.id);
                        });
                        if (child.pid) runningProcesses.set(script.id, child);
                    }, totalDelay * 1000);
                    totalDelay += 2;
                });
            }, 1000);
        });

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // --- Email status ---
    if (cleanPath === '/email-status') {
        if (req.method === 'GET') {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sent: state.sent }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', () => {
                try { const p = JSON.parse(body); state.sent = p.sent; } catch (e) {}
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            });
        }
        return;
    }

    // --- Signal status ---
    if (cleanPath === '/signal-status' && req.method === 'GET') {
        let signals = {};
        try { signals = JSON.parse(fs.readFileSync(signalFile, 'utf8')); } catch (e) {}
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(signals));
        return;
    }

    if (cleanPath === '/signal' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const p = JSON.parse(body);
                let signals = {};
                try { signals = JSON.parse(fs.readFileSync(signalFile, 'utf8')); } catch (e) {}
                signals[p.signal] = true;
                fs.writeFileSync(signalFile, JSON.stringify(signals, null, 4));
            } catch (e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // --- update-status ---
    if (cleanPath === '/api/update-status' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const p = JSON.parse(body);
                const processesPath = path.join(DATA_DIR, 'processes.json');
                const processes = JSON.parse(fs.readFileSync(processesPath, 'utf8'));
                const idx = processes.findIndex(pr => pr.id === String(p.id));
                if (idx !== -1) {
                    processes[idx].status = p.status;
                    processes[idx].currentStatus = p.currentStatus;
                    fs.writeFileSync(processesPath, JSON.stringify(processes, null, 4));
                }
            } catch (e) { console.error('update-status error:', e); }
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // --- Chat (KB + Work with Pace) ---
    if (cleanPath === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                let reply;
                if (parsed.messages && parsed.systemPrompt) {
                    // Caller 2: Work-with-Pace
                    reply = await callGemini(parsed.messages, parsed.systemPrompt);
                } else {
                    // Caller 1: KB Chat
                    const kbContent = parsed.knowledgeBase || '';
                    const systemPrompt = `You are a helpful assistant for Ferring Pharmaceuticals' PR Validation process. Answer questions using ONLY the following knowledge base:\n\n${kbContent}\n\nBe concise and accurate.`;
                    const history = (parsed.history || []).map(h => ({ role: h.role, content: h.content }));
                    history.push({ role: 'user', content: parsed.message });
                    reply = await callGemini(history, systemPrompt);
                }
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response: reply }));
            } catch (e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response: 'Error: ' + e.message }));
            }
        });
        return;
    }

    // --- Feedback questions ---
    if (cleanPath === '/api/feedback/questions' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                const systemPrompt = `You are an assistant helping refine feedback about the Ferring PR Validation knowledge base. Generate exactly 3 short clarifying questions (one per line, no numbering) to better understand this feedback: "${parsed.feedback}"\n\nKnowledge base context:\n${parsed.knowledgeBase || ''}`;
                const reply = await callGemini([{ role: 'user', content: 'Generate 3 clarifying questions.' }], systemPrompt);
                const questions = reply.split('\n').filter(q => q.trim().length > 0).slice(0, 3);
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ questions }));
            } catch (e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ questions: ['Could you clarify what you mean?', 'Which section does this apply to?', 'What would the correct information be?'] }));
            }
        });
        return;
    }

    // --- Feedback summarize ---
    if (cleanPath === '/api/feedback/summarize' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                const systemPrompt = `You are an assistant for updating the Ferring PR Validation knowledge base. Given user feedback and their answers, write a concise 1-2 sentence summary of the proposed change.`;
                const content = `Feedback: ${parsed.feedback}\nQuestions and answers: ${(parsed.questions || []).map((q, i) => `Q: ${q} A: ${(parsed.answers || [])[i] || ''}`).join('; ')}`;
                const reply = await callGemini([{ role: 'user', content }], systemPrompt);
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ summary: reply }));
            } catch (e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ summary: 'Update knowledge base with provided feedback.' }));
            }
        });
        return;
    }

    // --- Feedback queue ---
    if (cleanPath === '/api/feedback/queue') {
        if (req.method === 'GET') {
            let queue = [];
            try { queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8')); } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ queue }));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', () => {
                try {
                    const item = JSON.parse(body);
                    let queue = [];
                    try { queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8')); } catch(e) {}
                    queue.push({ ...item, status: 'pending', timestamp: new Date().toISOString() });
                    fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
                } catch(e) {}
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            });
            return;
        }
    }

    // --- Feedback queue delete ---
    if (cleanPath.startsWith('/api/feedback/queue/') && req.method === 'DELETE') {
        const id = cleanPath.split('/').pop();
        try {
            let queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            queue = queue.filter(item => item.id !== id);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
        } catch(e) {}
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // --- Feedback apply ---
    if (cleanPath === '/api/feedback/apply' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedbackId } = JSON.parse(body);
                let queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
                const item = queue.find(i => i.id === feedbackId);
                if (!item) throw new Error('Feedback not found');

                const currentKB = fs.readFileSync(KB_FILE, 'utf8');
                const prevFile = `snapshot_prev_${Date.now()}.md`;
                fs.writeFileSync(path.join(SNAPSHOTS_DIR, prevFile), currentKB);

                const systemPrompt = `You are an expert editor. Apply this change to the knowledge base and return the COMPLETE updated content. Change: "${item.summary}"`;
                const updatedKB = await callGemini([{ role: 'user', content: `Current KB:\n${currentKB}\n\nApply this change: ${item.summary}` }], systemPrompt);

                fs.writeFileSync(KB_FILE, updatedKB);
                const newFile = `snapshot_${Date.now()}.md`;
                fs.writeFileSync(path.join(SNAPSHOTS_DIR, newFile), updatedKB);

                let versions = [];
                try { versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8')); } catch(e) {}
                versions.push({ id: Date.now().toString(), timestamp: new Date().toISOString(), snapshotFile: newFile, previousFile: prevFile, changes: [item.summary] });
                fs.writeFileSync(KB_VERSIONS_PATH, JSON.stringify(versions, null, 4));

                queue = queue.filter(i => i.id !== feedbackId);
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));

                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, content: updatedKB }));
            } catch(e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // --- KB content ---
    if (cleanPath === '/api/kb/content' && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const versionId = url.searchParams.get('versionId');
        try {
            let content;
            if (versionId) {
                const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
                const version = versions.find(v => v.id === versionId);
                if (version) content = fs.readFileSync(path.join(SNAPSHOTS_DIR, version.snapshotFile), 'utf8');
                else content = fs.readFileSync(KB_FILE, 'utf8');
            } else {
                content = fs.readFileSync(KB_FILE, 'utf8');
            }
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content }));
        } catch(e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content: '' }));
        }
        return;
    }

    // --- KB versions ---
    if (cleanPath === '/api/kb/versions' && req.method === 'GET') {
        let versions = [];
        try { versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8')); } catch(e) {}
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ versions }));
        return;
    }

    // --- KB snapshots ---
    if (cleanPath.startsWith('/api/kb/snapshot/') && req.method === 'GET') {
        const filename = cleanPath.split('/').pop();
        try {
            const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, filename), 'utf8');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/markdown' });
            res.end(content);
        } catch(e) {
            res.writeHead(404, corsHeaders);
            res.end('Not found');
        }
        return;
    }

    // --- KB update ---
    if (cleanPath === '/api/kb/update' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const { content } = JSON.parse(body);
                fs.writeFileSync(KB_FILE, content);
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            } catch(e) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error' }));
            }
        });
        return;
    }

    // --- Debug ---
    if (cleanPath === '/debug-paths') {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ dataDir: DATA_DIR, exists: fs.existsSync(DATA_DIR), files: fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [] }));
        return;
    }

    // --- Static files ---
    serveStatic(req, res, cleanPath);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ferring PR Validation server running on port ${PORT}`);
});
