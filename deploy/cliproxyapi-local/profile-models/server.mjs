// Read-only sidecar: exposes ONLY a sanitized list of model ids found in pi viewer profiles.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.PROFILES_DIR || '/profiles';
const PORT = Number(process.env.PORT || 8081);
const ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:18080,http://localhost:18080').split(','));
const MAX_FILES = 200;
const MAX_BYTES = 256 * 1024;
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;

export function collectModels(value, out = new Set(), depth = 0, keyIsModel = false) {
  if (depth > 8) return out;
  if (typeof value === 'string') {
    if (keyIsModel && MODEL_RE.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectModels(v, out, depth + 1, keyIsModel);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectModels(v, out, depth + 1, /model/i.test(k) && k !== 'description');
  }
  return out;
}

export function readModels(dir = DIR) {
  const models = new Set();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).slice(0, MAX_FILES); } catch { return []; }
  for (const f of files) {
    try {
      const full = path.join(dir, f);
      if (fs.statSync(full).size > MAX_BYTES) continue;
      collectModels(JSON.parse(fs.readFileSync(full, 'utf8')), models);
    } catch { /* skip malformed */ }
  }
  return [...models].sort();
}

const SESSIONS_DIR = process.env.SESSIONS_DIR || '/sessions';
// Every directory that holds live Pi/Gentle Shell sessions (comma-separated), so terminals
// started from different agent homes are all reported, not only one.
const SESSIONS_DIRS = (process.env.SESSIONS_DIRS || SESSIONS_DIR).split(',').map((d) => d.trim()).filter(Boolean);
const STATE_FILE = process.env.VIEWER_STATE || '/viewer/web-shared-state.json';
const TAIL_BYTES = 4 * 1024 * 1024;

// Pi names a project's session folder after its path: C:/A B/C -> --C--A B-C--
export function sessionDirName(projectPath) {
  return '--' + String(projectPath).replace(/^[\\/]+/, '').replace(/[\\/:]/g, '-') + '--';
}

export function activeProjectPath(stateFile = STATE_FILE) {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const p = JSON.parse(raw.pi_viewer_projects);
    return (p.projects || []).find((x) => x.id === p.activeProjectId)?.path;
  } catch { return undefined; }
}

function lastModelOf(file) {
  const st = fs.statSync(file);
  const len = Math.min(st.size, TAIL_BYTES);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, len, st.size - len); } finally { fs.closeSync(fd); }
  const scan = (text) => {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const isMc = lines[i].includes('"model_change"');
      const isAsst = lines[i].includes('"role":"assistant"');
      if (!isMc && !isAsst) continue;
      try {
        const e = JSON.parse(lines[i]);
        if (e.type === 'model_change' && e.modelId && MODEL_RE.test(e.modelId)) return `${e.provider || 'oh-my-cpa'}/${e.modelId}`;
        const m = e.message;
        if (m && m.role === 'assistant' && m.model && MODEL_RE.test(m.model)) return `${m.provider || 'oh-my-cpa'}/${m.model}`;
      } catch { /* partial line */ }
    }
    return undefined;
  };
  const tail = scan(buf.toString('utf8'));
  if (tail || st.size <= len) return tail;
  // Long session: the only model_change may sit at the start of the file.
  const hb = Buffer.alloc(65536);
  const fd2 = fs.openSync(file, 'r');
  try { fs.readSync(fd2, hb, 0, hb.length, 0); } finally { fs.closeSync(fd2); }
  return scan(hb.toString('utf8'));
}

// The model currently selected in Pi Viewer for the active project (newest session's last model_change).
const RECENT_MS = 30 * 60 * 1000;

// Models of sessions touched recently in ANY project (Gentle Shell terminal sessions included).
export function readRecentModels(sessionsDirs = SESSIONS_DIRS, now = Date.now()) {
  const out = [];
  const roots = Array.isArray(sessionsDirs) ? sessionsDirs : [sessionsDirs];
  const all = [];
  for (const root of roots) {
    try {
      for (const d of fs.readdirSync(root)) {
        const dir = path.join(root, d);
        try {
          for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.jsonl')) continue;
            const p = path.join(dir, f);
            const t = fs.statSync(p).mtimeMs;
            if (now - t <= RECENT_MS) all.push({ p, t });
          }
        } catch { /* not a dir */ }
      }
    } catch { /* missing root */ }
  }
  all.sort((a, b) => b.t - a.t);
  // One entry per distinct model, however many terminals share it.
  for (const { p } of all.slice(0, 40)) {
    try { const m = lastModelOf(p); if (m && !out.includes(m)) out.push(m); } catch { /* skip */ }
  }
  return out;
}

export function readAllActiveModels(sessionsDirs = SESSIONS_DIRS, stateFile = STATE_FILE) {
  const dirs = Array.isArray(sessionsDirs) ? sessionsDirs : [sessionsDirs];
  const active = dirs.flatMap((d) => readActiveModels(d, stateFile));
  return [...new Set([...active, ...readRecentModels(dirs)])];
}

export function readActiveModels(sessionsDir = SESSIONS_DIR, stateFile = STATE_FILE) {
  try {
    const proj = activeProjectPath(stateFile);
    if (!proj) return [];
    const dir = path.join(sessionsDir, sessionDirName(proj));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f, t } of files.slice(0, 5)) {
      // A stale session is not an open terminal: ignore anything idle past the recency window.
      if (Date.now() - t > RECENT_MS) continue;
      const m = lastModelOf(path.join(dir, f));
      if (m) return [m];
    }
  } catch { /* none */ }
  return [];
}

export function handler(req, res) {
  const origin = req.headers.origin;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
  if (origin && ORIGINS.has(origin)) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  if (req.method !== 'GET' || req.url.split('?')[0] !== '/models') {
    res.writeHead(req.method === 'GET' ? 404 : 405, headers); return res.end('{"error":"not_found"}');
  }
  if (origin && !ORIGINS.has(origin)) { res.writeHead(403, headers); return res.end('{"error":"forbidden_origin"}'); }
  res.writeHead(200, headers);
  res.end(JSON.stringify({ models: readAllActiveModels(), profiles: readModels() }));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const s = http.createServer(handler);
  s.headersTimeout = 5000; s.requestTimeout = 5000; s.maxHeadersCount = 50;
  s.listen(PORT, '0.0.0.0', () => console.log('profile-models on', PORT));
}
