try { require('dotenv').config(); } catch(e) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const KB_PATH = path.join(__dirname, 'src/data/knowledgeBase.md');
const FEEDBACK_QUEUE_PATH = path.join(DATA_DIR, 'feedbackQueue.json');
const KB_VERSIONS_PATH = path.join(DATA_DIR, 'kbVersions.json');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

let state = { sent: false, hitl: {}, confirmed: false, signals: {} };
let runningProcesses = new Map();

// Initialize files on startup
const initFiles = () => {
    const signalFile = path.join(__dirname, 'interaction-signals.json');
    if (!fs.existsSync(signalFile)) {
        fs.writeFileSync(signalFile, JSON.stringify({ APPROVE_MANUAL_REVIEW: false }, null, 4));
    }
    const processesPath = path.join(DATA_DIR, 'processes.json');
    if (!fs.existsSync(processesPath)) {
        const base = path.join(DATA_DIR, 'base_processes.json');
        if (fs.existsSync(base)) fs.copyFileSync(base, processesPath);
    }
    if (!fs.existsSync(FEEDBACK_QUEUE_PATH)) fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
    if (!fs.existsSync(KB_VERSIONS_PATH)) fs.writeFileSync(KB_VERSIONS_PATH, '[]');
    if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
};

initFiles();

const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.jsx': 'application/javascript', '.json': 'application/json',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf', '.webm': 'video/webm', '.ico': 'image/x-icon',
        '.md': 'text/markdown', '.woff': 'font/woff', '.woff2': 'font/woff2'
    };
    return types[ext] || 'application/octet-stream';
};

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) { return null; } };

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const cleanPath = url.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // ── RESET ─────────────────────────────────────────────────────────────────
    if (cleanPath === '/reset') {
        state = { sent: false, hitl: {}, confirmed: false, signals: {} };
        console.log('Demo Reset Triggered');

        const signalFile = path.join(__dirname, 'interaction-signals.json');
        fs.writeFileSync(signalFile, JSON.stringify({ APPROVE_MANUAL_REVIEW: false }, null, 4));

        runningProcesses.forEach((proc) => {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { }
        });
        runningProcesses.clear();

        exec('pkill -9 -f "node(.*)simulation_scripts" || true', (err) => {
            setTimeout(() => {
                const processesPath = path.join(DATA_DIR, 'processes.json');
                const cases = [
                    { id: "FPR_001", name: "FPR-001: Standard PR Auto-Approval", category: "PR Validation", stockId: "PR-2026-00847", year: new Date().toISOString().split('T')[0], status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-00847", supplierName: "Sigma-Aldrich (Merck)", amount: "CHF 12,450.00", companyCode: "1000", region: "India/ROW", documentType: "Quotation" },
                    { id: "FPR_002", name: "FPR-002: Supplier & Pricing Mismatch", category: "PR Validation", stockId: "PR-2026-00912", year: new Date().toISOString().split('T')[0], status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-00912", supplierName: "Bachem AG", amount: "USD 45,800.00", companyCode: "2100", region: "India/ROW", documentType: "Invoice" },
                    { id: "FPR_003", name: "FPR-003: Manual Review Required", category: "PR Validation", stockId: "PR-2026-01045", year: new Date().toISOString().split('T')[0], status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01045", supplierName: "Catalent Pharma Solutions", amount: "EUR 185,000.00", companyCode: "3200", region: "India/ROW", documentType: "SOW" },
                    { id: "FPR_004", name: "FPR-004: No Attachments", category: "PR Validation", stockId: "PR-2026-01100", year: new Date().toISOString().split('T')[0], status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01100", supplierName: "Lonza Group AG", amount: "CHF 340,000.00", companyCode: "1000", region: "India/ROW", documentType: "None" },
                    { id: "FPR_005", name: "FPR-005: US ServiceNow Flow", category: "PR Validation", stockId: "PR-2026-01203", year: new Date().toISOString().split('T')[0], status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01203", supplierName: "Thermo Fisher Scientific", amount: "USD 67,850.00", companyCode: "4100", region: "US/Canada", documentType: "PO" },
                    { id: "FPR_006", name: "FPR-006: Full Pace Showcase", category: "PR Validation", stockId: "PR-2026-01567", year: new Date().toISOString().split('T')[0], status: "In Progress", currentStatus: "Initializing...", prId: "PR-2026-01567", supplierName: "Boehringer Ingelheim", amount: "EUR 2,780,000.00", companyCode: "4100", region: "US/Canada", documentType: "MSA + SOW" }
                ];
                fs.writeFileSync(processesPath, JSON.stringify(cases, null, 4));

                // Reset process log files
                ['FPR_001','FPR_002','FPR_003','FPR_004','FPR_005','FPR_006'].forEach(id => {
                    fs.writeFileSync(path.join(DATA_DIR, `process_${id}.json`),
                        JSON.stringify({ logs: [], keyDetails: {}, sidebarArtifacts: [] }, null, 4));
                });

                fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
                fs.writeFileSync(KB_VERSIONS_PATH, '[]');

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
                        const child = exec(
                            `node "${scriptPath}" > "${scriptPath}.log" 2>&1`,
                            (error) => {
                                if (error && error.code !== 0) {
                                    console.error(`${script.file} error:`, error.message);
                                }
                                runningProcesses.delete(script.id);
                            }
                        );
                        runningProcesses.set(script.id, child);
                    }, totalDelay * 1000);
                    totalDelay += 2;
                });
            }, 1000);
        });

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }


    // ── PER-PROCESS HITL ─────────────────────────────────────────────────────────
    if (cleanPath.startsWith('/hitl/')) {
        const processId = cleanPath.replace('/hitl/', '').split('?')[0];
        if (!processId) {
            res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'processId required' }));
            return;
        }
        if (req.method === 'GET') {
            const hitlState = state.hitl[processId] || { pending: false, action: null };
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ pending: hitlState.pending || false, action: hitlState.action || null }));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', () => {
                try {
                    const p = JSON.parse(body);
                    state.hitl[processId] = {
                        pending: p.pending !== undefined ? p.pending : (p.action ? false : true),
                        action: p.action !== undefined ? p.action : null
                    };
                    console.log(`HITL [${processId}] updated:`, state.hitl[processId]);
                } catch(e) { console.error('HITL parse error:', e); }
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', processId, state: state.hitl[processId] }));
            });
            return;
        }
        res.writeHead(405, corsHeaders);
        res.end('Method Not Allowed');
        return;
    }

    // ── EMAIL STATUS ──────────────────────────────────────────────────────────
    if (cleanPath === '/email-status') {
        if (req.method === 'GET') {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sent: state.sent }));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', () => {
                try { const p = JSON.parse(body); state.sent = p.sent; } catch(e) {}
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            });
        }
        return;
    }

    // ── SIGNAL STATUS ─────────────────────────────────────────────────────────
    if (cleanPath === '/signal-status') {
        const signalFile = path.join(__dirname, 'interaction-signals.json');
        let signals = {};
        try { signals = JSON.parse(fs.readFileSync(signalFile, 'utf8')); } catch(e) {}
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
                const signalFile = path.join(__dirname, 'interaction-signals.json');
                let signals = {};
                try { signals = JSON.parse(fs.readFileSync(signalFile, 'utf8')); } catch(e) {}
                if (p.signal) signals[p.signal] = true;
                const tmp = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
                fs.renameSync(tmp, signalFile);
            } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // ── UPDATE STATUS ─────────────────────────────────────────────────────────
    if (cleanPath === '/api/update-status' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const p = JSON.parse(body);
                const processesPath = path.join(DATA_DIR, 'processes.json');
                const processes = readJson(processesPath) || [];
                const idx = processes.findIndex(proc => proc.id === String(p.id));
                if (idx !== -1) {
                    processes[idx].status = p.status;
                    processes[idx].currentStatus = p.currentStatus;
                    fs.writeFileSync(processesPath, JSON.stringify(processes, null, 4));
                }
            } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    // ── CHAT (KB + Work-with-Pace) ────────────────────────────────────────────
    if (cleanPath === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                const GEMINI_KEY = process.env.GEMINI_API_KEY;
                const MODEL = process.env.VITE_MODEL || 'gemini-2.5-flash';
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(GEMINI_KEY);
                const model = genAI.getGenerativeModel({ model: MODEL });

                let responseText = '';
                if (parsed.messages && parsed.systemPrompt) {
                    // Work-with-Pace contract
                    const chat = model.startChat({
                        systemInstruction: parsed.systemPrompt,
                        history: parsed.messages.slice(0, -1).map(m => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }]
                        }))
                    });
                    const last = parsed.messages[parsed.messages.length - 1];
                    const result = await chat.sendMessage(last.content);
                    responseText = result.response.text();
                } else {
                    // KB chat contract
                    const systemPrompt = `You are a helpful assistant for Ferring PR Validation PR Validation. Use this knowledge base:\n\n${parsed.knowledgeBase}`;
                    const chat = model.startChat({
                        systemInstruction: systemPrompt,
                        history: (parsed.history || []).slice(0, -1).map(m => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }]
                        }))
                    });
                    const result = await chat.sendMessage(parsed.message);
                    responseText = result.response.text();
                }

                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response: responseText }));
            } catch(e) {
                console.error('Chat error:', e);
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response: 'Sorry, I encountered an error. Please try again.' }));
            }
        });
        return;
    }

    // ── FEEDBACK ENDPOINTS ────────────────────────────────────────────────────
    if (cleanPath === '/api/feedback/questions' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedback, knowledgeBase } = JSON.parse(body);
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: process.env.VITE_MODEL || 'gemini-2.5-flash' });
                const prompt = `You are helping clarify feedback about the Ferring PR Validation PR Validation knowledge base.\n\nKnowledge base:\n${knowledgeBase}\n\nFeedback: "${feedback}"\n\nGenerate exactly 3 short clarifying questions to better understand this feedback. Return as JSON array: ["Q1?","Q2?","Q3?"]`;
                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();
                const match = text.match(/\[[\s\S]*\]/);
                const questions = match ? JSON.parse(match[0]) : ["Can you elaborate?", "What outcome do you expect?", "Any specific examples?"];
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ questions }));
            } catch(e) {
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ questions: ["Can you elaborate?", "What specific issue did you encounter?", "What would the correct behavior be?"] }));
            }
        });
        return;
    }

    if (cleanPath === '/api/feedback/summarize' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedback, questions, answers, knowledgeBase } = JSON.parse(body);
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: process.env.VITE_MODEL || 'gemini-2.5-flash' });
                const qa = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || 'N/A'}`).join('\n\n');
                const prompt = `Summarize this feedback into a structured knowledge base update proposal.\n\nOriginal feedback: ${feedback}\n\nClarifications:\n${qa}\n\nProvide a concise 2-3 sentence summary of what should be updated in the knowledge base.`;
                const result = await model.generateContent(prompt);
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ summary: result.response.text() }));
            } catch(e) {
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ summary: 'Feedback captured and queued for review.' }));
            }
        });
        return;
    }

    if (cleanPath === '/api/feedback/queue') {
        if (req.method === 'GET') {
            const queue = readJson(FEEDBACK_QUEUE_PATH) || [];
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
                    const queue = readJson(FEEDBACK_QUEUE_PATH) || [];
                    queue.push({ ...item, status: 'pending', timestamp: new Date().toISOString() });
                    fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
                } catch(e) {}
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            });
            return;
        }
    }

    if (cleanPath.startsWith('/api/feedback/queue/') && req.method === 'DELETE') {
        const id = cleanPath.replace('/api/feedback/queue/', '');
        let queue = readJson(FEEDBACK_QUEUE_PATH) || [];
        queue = queue.filter(item => item.id !== id);
        fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    if (cleanPath === '/api/feedback/apply' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { feedbackId } = JSON.parse(body);
                const queue = readJson(FEEDBACK_QUEUE_PATH) || [];
                const item = queue.find(i => i.id === feedbackId);
                if (!item) { res.writeHead(404, corsHeaders); res.end('{}'); return; }

                const currentKB = fs.readFileSync(KB_PATH, 'utf8');
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: process.env.VITE_MODEL || 'gemini-2.5-flash' });
                const prompt = `Update this knowledge base based on the feedback. Return only the updated markdown.\n\nCurrent KB:\n${currentKB}\n\nFeedback to apply: ${item.summary}`;
                const result = await model.generateContent(prompt);
                const updatedKB = result.response.text();

                const ts = Date.now();
                const prevFile = `kb_prev_${ts}.md`;
                const snapFile = `kb_snap_${ts}.md`;
                fs.writeFileSync(path.join(SNAPSHOTS_DIR, prevFile), currentKB);
                fs.writeFileSync(path.join(SNAPSHOTS_DIR, snapFile), updatedKB);
                fs.writeFileSync(KB_PATH, updatedKB);

                const versions = readJson(KB_VERSIONS_PATH) || [];
                versions.push({ id: ts.toString(), timestamp: new Date().toISOString(), snapshotFile: snapFile, previousFile: prevFile, changes: [item.summary] });
                fs.writeFileSync(KB_VERSIONS_PATH, JSON.stringify(versions, null, 4));

                const updQueue = queue.map(i => i.id === feedbackId ? { ...i, status: 'applied' } : i);
                fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(updQueue, null, 4));

                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, content: updatedKB }));
            } catch(e) {
                console.error('Apply feedback error:', e);
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false }));
            }
        });
        return;
    }

    // ── KB ENDPOINTS ──────────────────────────────────────────────────────────
    if (cleanPath === '/api/kb/content') {
        const versionId = url.searchParams.get('versionId');
        if (versionId) {
            const versions = readJson(KB_VERSIONS_PATH) || [];
            const ver = versions.find(v => v.id === versionId);
            if (ver) {
                const snap = path.join(SNAPSHOTS_DIR, ver.snapshotFile);
                const content = fs.existsSync(snap) ? fs.readFileSync(snap, 'utf8') : '';
                res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ content }));
                return;
            }
        }
        const content = fs.existsSync(KB_PATH) ? fs.readFileSync(KB_PATH, 'utf8') : '';
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content }));
        return;
    }

    if (cleanPath === '/api/kb/versions') {
        const versions = readJson(KB_VERSIONS_PATH) || [];
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ versions }));
        return;
    }

    if (cleanPath.startsWith('/api/kb/snapshot/')) {
        const filename = cleanPath.replace('/api/kb/snapshot/', '');
        const snap = path.join(SNAPSHOTS_DIR, filename);
        if (fs.existsSync(snap)) {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/markdown' });
            res.end(fs.readFileSync(snap, 'utf8'));
        } else {
            res.writeHead(404, corsHeaders); res.end('Not found');
        }
        return;
    }

    if (cleanPath === '/api/kb/update' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try { const { content } = JSON.parse(body); fs.writeFileSync(KB_PATH, content); } catch(e) {}
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        });
        return;
    }

    if (cleanPath === '/debug-paths') {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ dataDir: DATA_DIR, exists: fs.existsSync(DATA_DIR), files: fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [] }));
        return;
    }

    // ── STATIC FILES ──────────────────────────────────────────────────────────
    let filePath = cleanPath === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, cleanPath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, corsHeaders); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(filePath)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': getMimeType(filePath) });
        res.end(content);
    } catch(e) {
        res.writeHead(404, corsHeaders); res.end('Not found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ferring PR Validation server running on port ${PORT}`);
});
