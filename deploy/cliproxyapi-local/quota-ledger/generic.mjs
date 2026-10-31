// Provider-agnostic adapter: Shell-PAMC's normalized quota item -> ledger entry.
// Works for every provider Shell-PAMC reads (claude, codex, antigravity, kimi, xai, devin, meta, plugins).

const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : undefined);
const win = (w) => (w ? { remaining: pct(w.remaining_percent), resetAt: typeof w.reset_at_ms === 'number' ? w.reset_at_ms : undefined, periodH: w.period_hours } : undefined);

const isFive = (w) => w.kind === 'five_hour' || w.id === 'five_hour' || w.period_hours === 5;
const isWeekly = (w) => w.kind === 'weekly' || w.id === 'weekly' || w.id === 'seven_day' || w.period_hours === 168;

// Primary window = the 5h one. A provider with no 5h window falls back to its shortest
// window (daily, monthly...), so the same rule still orders it instead of exempting it.
export function entryFromQuotaItem(item) {
  const ws = (item.windows ?? []).filter((w) => typeof w.remaining_percent === 'number');
  const five = ws.find(isFive)
    ?? [...ws].filter((w) => typeof w.period_hours === 'number').sort((a, b) => a.period_hours - b.period_hours)[0];
  const weekly = ws.find(isWeekly);
  const primary = win(five);
  // A credential Shell-PAMC reports as quota-exceeded has no capacity whatever its windows say.
  if (primary && item.quota_exceeded) primary.remaining = 0;
  return { readAt: item.observed_at_ms, fiveHour: primary, weekly: win(weekly) };
}

// Groups by provider. Antigravity is handled by its own two-family reader.
export function groupByProvider(items, skip = ['antigravity']) {
  const groups = new Map();
  for (const it of items) {
    if (it.disabled || skip.includes(it.provider)) continue;
    if (!groups.has(it.provider)) groups.set(it.provider, []);
    groups.get(it.provider).push({ name: it.name, auth_index: it.auth_index, families: { default: entryFromQuotaItem(it) } });
  }
  return groups;
}

export function makeOmcClient(base, key) {
  let cookie;
  const login = async () => {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: key }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`omc login HTTP ${r.status}`);
    cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  };
  const req = async (method, path, body, retry = true) => {
    if (!cookie) await login();
    const r = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    if (r.status === 401 && retry) { cookie = undefined; return req(method, path, body, false); }
    if (!r.ok) throw new Error(`omc HTTP ${r.status} ${path}`);
    return r.json();
  };
  return {
    // Ask Shell-PAMC to re-read upstream first, so the ledger never ranks on a stale snapshot.
    async quota(authIndexes) {
      if (authIndexes?.length) await req('POST', '/api/v1/management/quota/refresh', { auth_indexes: authIndexes }).catch(() => {});
      return (await req('GET', '/api/v1/management/quota')).quotas ?? [];
    },
  };
}
