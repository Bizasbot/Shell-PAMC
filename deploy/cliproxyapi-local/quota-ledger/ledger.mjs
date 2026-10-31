// Pure capacity-ledger logic: no I/O, so it can be tested without CPA.
// Families: quota is shared per model group, so each account has one entry per family.

export const FAMILIES = ['claude_gpt', 'gemini'];
export const DEFAULTS = { minFiveHour: 0.10, minWeekly: 0.02, maxAgeMs: 10 * 60 * 1000 };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : undefined; };

// retrieveUserQuotaSummary body -> { claude_gpt: {...} } windows by bucket.
export function parseSummary(body) {
  const out = {};
  for (const g of body?.groups ?? []) {
    const name = String(g.displayName ?? '').toLowerCase();
    const family = name.includes('claude') || name.includes('gpt') ? 'claude_gpt' : name.includes('gemini') ? 'gemini' : undefined;
    if (!family) continue;
    const entry = out[family] ?? (out[family] = {});
    for (const b of g.buckets ?? []) {
      const w = { remaining: num(b.remainingFraction), resetAt: ms(b.resetTime) };
      if (b.window === '5h') entry.fiveHour = w;
      else if (b.window === 'weekly') entry.weekly = w;
    }
  }
  return out;
}

// fetchAvailableModels body -> the gemini 5h reading. Every gemini model shares one value;
// the lowest remaining fraction is kept so a divergent model can never be over-reported.
export function parseGeminiFromModels(body) {
  let worst;
  for (const [id, m] of Object.entries(body?.models ?? {})) {
    if (!id.startsWith('gemini')) continue;
    const q = m?.quotaInfo;
    const remaining = num(q?.remainingFraction);
    if (remaining === undefined) continue;
    if (!worst || remaining < worst.remaining) worst = { remaining, resetAt: ms(q.resetTime) };
  }
  return worst;
}

// One account+family -> status. Unknown readings are never treated as capacity.
export function classify(entry, now, cfg = DEFAULTS) {
  if (!entry || entry.readAt === undefined || now - entry.readAt > cfg.maxAgeMs) return { status: 'unknown', reason: 'stale_or_failed_read' };
  const f = entry.fiveHour;
  if (!f || f.remaining === undefined || f.resetAt === undefined) return { status: 'unknown', reason: 'no_five_hour_reading' };
  if (f.resetAt <= now) return { status: 'unknown', reason: 'reading_expired' };
  if (entry.weekly?.remaining !== undefined && entry.weekly.remaining < cfg.minWeekly) {
    return { status: 'exhausted', reason: 'weekly', until: entry.weekly.resetAt };
  }
  if (f.remaining < cfg.minFiveHour) return { status: 'exhausted', reason: 'five_hour', until: f.resetAt };
  return { status: 'apt' };
}

// Order of use: soonest five-hour reset first (capacity about to expire is spent first),
// then most remaining. Only apt accounts are returned.
export function rank(accounts, family, now, cfg = DEFAULTS) {
  const rows = accounts.map((a) => {
    const e = a.families?.[family];
    return { name: a.name, ...classify(e, now, cfg), fiveHour: e?.fiveHour, weekly: e?.weekly };
  });
  // A window that has not started reports a rolling reset of now+5h that drifts every second.
  // Those accounts are one stable tie group (reset pinned to +Infinity), ordered by name.
  const FIVE_H = 5 * 3600e3, SLACK = 5 * 60e3;
  const key = (r) => (r.fiveHour.remaining >= 0.999 && r.fiveHour.resetAt - now > FIVE_H - SLACK ? Infinity : r.fiveHour.resetAt);
  const apt = rows.filter((r) => r.status === 'apt').sort((x, y) => {
    const kx = key(x), ky = key(y);
    if (kx !== ky) return kx < ky ? -1 : 1;
    return (y.fiveHour.remaining - x.fiveHour.remaining) || x.name.localeCompare(y.name);
  });
  const out = rows.filter((r) => r.status !== 'apt');
  return { order: apt.map((r) => r.name), excluded: out.map((r) => ({ name: r.name, status: r.status, reason: r.reason, until: r.until })), rows: apt };
}

// Combined ranking for credentials whose quota is split per model family but whose routing
// priority is a single number. An account is apt only if it is apt in EVERY family: one exhausted
// (or unreadable) family takes the whole account out until that window refills. Among apt
// accounts the soonest started reset in any family goes first, then the lowest remaining
// fraction (the scarcer family is the one that will run out first), then name.
export function rankCombined(accounts, families, now, cfg = DEFAULTS) {
  const FIVE_H = 5 * 3600e3, SLACK = 5 * 60e3;
  const rows = accounts.map((a) => {
    const per = families.map((f) => ({ family: f, entry: a.families?.[f], ...classify(a.families?.[f], now, cfg) }));
    const bad = per.filter((p) => p.status !== 'apt');
    if (bad.length) {
      const worst = bad.find((p) => p.status === 'exhausted') ?? bad[0];
      const until = bad.filter((p) => p.status === 'exhausted').map((p) => p.until).filter(Number.isFinite);
      return { name: a.name, status: worst.status, reason: `${worst.family}:${worst.reason}`, until: until.length ? Math.max(...until) : undefined };
    }
    const keys = per.map((p) => (p.entry.fiveHour.remaining >= 0.999 && p.entry.fiveHour.resetAt - now > FIVE_H - SLACK ? Infinity : p.entry.fiveHour.resetAt));
    const rem = Math.min(...per.map((p) => p.entry.fiveHour.remaining));
    const first = per.reduce((b, p) => (p.entry.fiveHour.resetAt < b.entry.fiveHour.resetAt ? p : b));
    return { name: a.name, status: 'apt', key: Math.min(...keys), remaining: rem, fiveHour: { remaining: rem, resetAt: first.entry.fiveHour.resetAt } };
  });
  const apt = rows.filter((r) => r.status === 'apt').sort((x, y) => (x.key !== y.key ? (x.key < y.key ? -1 : 1) : (x.remaining - y.remaining) || x.name.localeCompare(y.name)));
  const out = rows.filter((r) => r.status !== 'apt');
  return { order: apt.map((r) => r.name), excluded: out.map((r) => ({ name: r.name, status: r.status, reason: r.reason, until: r.until })), rows: apt };
}
