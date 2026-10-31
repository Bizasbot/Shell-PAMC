// Quota-aware ordering service for CPA antigravity credentials.
//   node service.mjs once            -> dry run, prints the plan
//   node service.mjs once --apply    -> one cycle, writes priorities
//   node service.mjs loop            -> cycles every INTERVAL_S (writes only if APPLY=1)
//   node service.mjs restore         -> puts back the priorities saved in backup/auth-state-before.json
// Kill switch: create the file named by DISABLE_FILE (default ./DISABLED) and the loop stops writing.
import { readFileSync, existsSync } from 'node:fs';
import { makeClient, readAll } from './reader.mjs';
import { rank, rankCombined, DEFAULTS, FAMILIES } from './ledger.mjs';
import { planPriorities, diffPlan } from './apply.mjs';
import { makeOmcClient, groupByProvider } from './generic.mjs';

const OMC_BASE = process.env.OMC_BASE || 'http://127.0.0.1:18080/omc';

const BASE_URL = process.env.CPA_BASE || 'http://127.0.0.1:18317/v0/management';
const KEY = process.env.CPA_KEY;
const INTERVAL_S = Number(process.env.INTERVAL_S || 180);
const DISABLE_FILE = process.env.DISABLE_FILE || new URL('./DISABLED', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const BACKUP = new URL('./backup/auth-state-before.json', import.meta.url);
const cfg = { ...DEFAULTS, minFiveHour: Number(process.env.MIN_FIVE_HOUR || DEFAULTS.minFiveHour) };
const short = (n) => n.replace(/^antigravity-/, '').replace(/\.json$/, '').slice(0, 24);

async function currentPriorities(client) {
  const { files } = await client.call('/auth-files');
  return Object.fromEntries(files.filter((f) => f.provider === 'antigravity' && !f.disabled).map((f) => [f.name, f.priority ?? 0]));
}

async function writePriority(client, { name, priority }) {
  const r = await fetch(`${BASE_URL}/auth-files/fields`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, priority }), signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${name}`);
}

export async function cycle(client, { apply }) {
  const now = Date.now();
  const accounts = await readAll(client, now);
  const failed = accounts.filter((a) => a.error);
  // If most reads failed the problem is the reader, not the accounts: do not reshuffle on it.
  if (accounts.length === 0 || failed.length > accounts.length / 2) {
    return { skipped: `too many failed reads (${failed.length}/${accounts.length})`, changes: [] };
  }
  const ranking = rankCombined(accounts, FAMILIES, now, cfg);
  const plan = planPriorities(ranking, accounts.map((a) => a.name));
  const changes = diffPlan(await currentPriorities(client), plan);
  if (apply) for (const c of changes) await writePriority(client, c);
  return { ranking, plan, changes, applied: apply, failed: failed.length };
}

// Every other provider Shell-PAMC reads (claude, codex, kimi, xai, devin, meta, plugins).
// Each provider is its own pool, so it is ranked on its own with the same rule.
export async function cycleOthers(client, omc, { apply }) {
  const now = Date.now();
  const files = (await client.call('/auth-files')).files.filter((f) => f.provider !== 'antigravity' && !f.disabled);
  const items = await omc.quota(files.map((f) => f.auth_index));
  const groups = groupByProvider(items);
  const current = Object.fromEntries(files.map((f) => [f.name, f.priority ?? 0]));
  const out = [];
  for (const [provider, accounts] of groups) {
    // A pool of one has nothing to order; writing a priority would only shift its weight against
    // other providers that serve the same models. It starts ordering as soon as a second account joins.
    if (accounts.length < 2) { console.log(new Date(now).toISOString(), `provider=${provider} single account: nothing to order, untouched`); continue; }
    const ranking = rank(accounts, 'default', now, cfg);
    const plan = planPriorities(ranking, accounts.map((a) => a.name));
    const changes = diffPlan(current, plan);
    if (apply) for (const c of changes) await writePriority(client, c);
    out.push({ provider, ranking, plan, changes, applied: apply });
  }
  return out;
}

function reportOthers(list, now = Date.now()) {
  for (const r of list) {
    console.log(new Date(now).toISOString(), `${r.applied ? 'APPLIED' : 'DRY-RUN'} provider=${r.provider} apt=${r.ranking.order.length} out=${r.ranking.excluded.length} changes=${r.changes.length}`);
    r.ranking.rows.forEach((x, i) => console.log(`  ${i + 1}. ${short(x.name)} 5h=${(x.fiveHour.remaining * 100).toFixed(0)}% reset=${((x.fiveHour.resetAt - now) / 36e5).toFixed(2)}h prio=${r.plan[x.name]}`));
    r.ranking.excluded.forEach((x) => console.log(`  x ${short(x.name)} ${x.status}/${x.reason}`));
  }
}

function report(res, now = Date.now()) {
  if (res.skipped) return console.log(new Date(now).toISOString(), 'SKIP', res.skipped);
  console.log(new Date(now).toISOString(), `${res.applied ? 'APPLIED' : 'DRY-RUN'} families=${FAMILIES.join('+')} apt=${res.ranking.order.length} out=${res.ranking.excluded.length} changes=${res.changes.length}`);
  res.ranking.rows.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${short(r.name)} 5h=${(r.fiveHour.remaining * 100).toFixed(0)}% reset=${((r.fiveHour.resetAt - now) / 36e5).toFixed(2)}h prio=${res.plan[r.name]}`));
  res.ranking.excluded.forEach((x) => console.log(`  x ${short(x.name)} ${x.status}/${x.reason}`));
}

if (process.argv[1]?.endsWith('service.mjs')) {
  if (!KEY) { console.error('CPA_KEY is required'); process.exit(2); }
  const client = makeClient(BASE_URL, KEY);
  const omc = makeOmcClient(OMC_BASE, process.env.OMC_KEY || KEY);
  const [mode, flag] = process.argv.slice(2);
  const runAll = async (apply) => {
    report(await cycle(client, { apply }));
    try { reportOthers(await cycleOthers(client, omc, { apply })); } catch (e) { console.error(new Date().toISOString(), 'other providers failed (left untouched):', e.message); }
  };
  if (mode === 'restore') {
    const saved = JSON.parse(readFileSync(BACKUP, 'utf8'));
    const cur = await currentPriorities(client);
    for (const [name, s] of Object.entries(saved)) if (name in cur && cur[name] !== (s.priority ?? 0)) { await writePriority(client, { name, priority: s.priority ?? 0 }); console.log('restored', short(name)); }
    console.log('restore done');
  } else if (mode === 'once') {
    await runAll(flag === '--apply');
  } else if (mode === 'loop') {
    const apply = process.env.APPLY === '1';
    for (;;) {
      try {
        if (existsSync(DISABLE_FILE)) console.log(new Date().toISOString(), 'DISABLED file present: not writing');
        else await runAll(apply);
      } catch (e) { console.error(new Date().toISOString(), 'cycle failed:', e.message); }
      await new Promise((r) => setTimeout(r, INTERVAL_S * 1000));
    }
  } else { console.error('usage: service.mjs once [--apply] | loop | restore'); process.exit(2); }
}
