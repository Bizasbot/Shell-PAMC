// Read-only collector. Calls CPA management /api-call to read quota; consumes no model tokens.
import { parseSummary, parseGeminiFromModels, rank, DEFAULTS } from './ledger.mjs';

const PLACEHOLDER = 'Bearer $TOKEN$';
const SUMMARY = 'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary';
const MODELS = 'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels';

export function makeClient(base, key) {
  const call = async (path, body) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
    return r.json();
  };
  const upstream = async (file, url) => {
    const res = await call('/api-call', {
      auth_index: file.auth_index, method: 'POST', url,
      header: { 'Content-Type': 'application/json', 'User-Agent': 'antigravity', Authorization: PLACEHOLDER },
      data: JSON.stringify({ project: file.project_id }),
    });
    if (res.status_code < 200 || res.status_code >= 300) throw new Error(`upstream ${res.status_code}`);
    return typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  };
  return { call, upstream };
}

// One account -> { name, families } or { name, error }. A failed read yields no families,
// which classify() reports as unknown, so the account stays out.
export async function readAccount(client, file, now = Date.now()) {
  try {
    const fam = parseSummary(await client.upstream(file, SUMMARY));
    const gem = parseGeminiFromModels(await client.upstream(file, MODELS));
    const families = {};
    if (fam.claude_gpt) families.claude_gpt = { ...fam.claude_gpt, readAt: now };
    if (gem) families.gemini = { fiveHour: gem, weekly: undefined, readAt: now };
    return { name: file.name, auth_index: file.auth_index, families };
  } catch (e) {
    return { name: file.name, auth_index: file.auth_index, families: {}, error: String(e.message ?? e) };
  }
}

export async function readAll(client, now = Date.now()) {
  const { files } = await client.call('/auth-files');
  const ag = files.filter((f) => f.provider === 'antigravity' && !f.disabled);
  const out = [];
  for (let i = 0; i < ag.length; i += 4) {
    out.push(...await Promise.all(ag.slice(i, i + 4).map((f) => readAccount(client, f, now))));
  }
  return out;
}

if (process.argv[1]?.endsWith('reader.mjs')) {
  const key = process.env.CPA_KEY;
  const client = makeClient(process.env.CPA_BASE || 'http://127.0.0.1:18317/v0/management', key);
  const now = Date.now();
  const accounts = await readAll(client, now);
  const short = (n) => n.replace(/^antigravity-/, '').replace(/\.json$/, '').slice(0, 26);
  for (const family of ['claude_gpt', 'gemini']) {
    const r = rank(accounts, family, now, DEFAULTS);
    console.log(`\n== ${family}: orden de uso (${r.order.length} aptas, ${r.excluded.length} fuera)`);
    r.rows.forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. ${short(x.name).padEnd(27)} 5h ${(x.fiveHour.remaining * 100).toFixed(0).padStart(3)}%  reinicia en ${((x.fiveHour.resetAt - now) / 36e5).toFixed(2)}h`));
    r.excluded.forEach((x) => console.log(` x  ${short(x.name).padEnd(27)} ${x.status}/${x.reason}`));
  }
  const errs = accounts.filter((a) => a.error);
  if (errs.length) console.log('\nerrores de lectura:', errs.map((e) => `${short(e.name)}: ${e.error}`).join('; '));
}
