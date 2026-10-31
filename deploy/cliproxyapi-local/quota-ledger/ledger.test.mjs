import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, rank, parseSummary, parseGeminiFromModels } from './ledger.mjs';

const NOW = Date.parse('2026-10-31T00:00:00Z');
const H = 3600e3;
const acct = (name, rem, resetInH, weekly = 0.9, readAt = NOW) => ({
  name, families: { gemini: { readAt, fiveHour: { remaining: rem, resetAt: NOW + resetInH * H }, weekly: { remaining: weekly, resetAt: NOW + 24 * H } } },
});

test('soonest five-hour reset is used first, even with fewer tokens left', () => {
  const r = rank([acct('idle', 1, 5), acct('started', 0.4, 3), acct('almost', 0.2, 0.3)], 'gemini', NOW);
  assert.deepEqual(r.order, ['almost', 'started', 'idle']);
});

test('unstarted windows (rolling now+5h reset) rank stably by name, after started ones', () => {
  const mk = (n, jitter) => acct(n, 1, 5 - jitter / H);
  const a = rank([mk('z', 1000), mk('b', 5000), mk('a', 3000), acct('started', 0.9, 2)], 'gemini', NOW);
  const b = rank([mk('z', 4000), mk('b', 100), mk('a', 9000), acct('started', 0.9, 2)], 'gemini', NOW);
  assert.deepEqual(a.order, ['started', 'a', 'b', 'z']);
  assert.deepEqual(b.order, a.order);
});

test('equal reset breaks the tie by most remaining', () => {
  const r = rank([acct('b', 0.5, 3), acct('a', 0.9, 3)], 'gemini', NOW);
  assert.deepEqual(r.order, ['a', 'b']);
});

test('below the five-hour reserve is excluded until its reset', () => {
  const c = classify(acct('x', 0.05, 2).families.gemini, NOW);
  assert.equal(c.status, 'exhausted'); assert.equal(c.reason, 'five_hour'); assert.equal(c.until, NOW + 2 * H);
});

test('exhausted weekly window excludes even with a full five-hour window', () => {
  const c = classify(acct('x', 1, 5, 0.0).families.gemini, NOW);
  assert.equal(c.status, 'exhausted'); assert.equal(c.reason, 'weekly');
});

test('missing, stale or expired readings are unknown and never ranked', () => {
  const stale = acct('stale', 1, 5, 0.9, NOW - 11 * 60e3);
  const expired = acct('expired', 1, -1);
  const none = { name: 'none', families: {} };
  const r = rank([stale, expired, none, acct('ok', 0.5, 2)], 'gemini', NOW);
  assert.deepEqual(r.order, ['ok']);
  assert.deepEqual(r.excluded.map((e) => e.status), ['unknown', 'unknown', 'unknown']);
});

test('parseSummary maps the Claude/GPT group and both windows', () => {
  const p = parseSummary({ groups: [{ displayName: 'Claude and GPT models', buckets: [
    { window: 'weekly', remainingFraction: 0.96, resetTime: '2026-11-01T04:58:49Z' },
    { window: '5h', remainingFraction: 1, resetTime: '2026-10-31T05:14:50Z' }] }] });
  assert.equal(p.claude_gpt.fiveHour.remaining, 1);
  assert.equal(p.claude_gpt.weekly.remaining, 0.96);
});

test('parseGeminiFromModels keeps the lowest remaining fraction', () => {
  const g = parseGeminiFromModels({ models: {
    'gemini-3-flash': { quotaInfo: { remainingFraction: 0.97, resetTime: '2026-10-31T03:27:16Z' } },
    'gemini-3.5-flash-lite': { quotaInfo: { remainingFraction: 0.5, resetTime: '2026-10-31T03:27:16Z' } },
    'claude-x': { quotaInfo: { remainingFraction: 0.1, resetTime: '2026-10-31T03:27:16Z' } } } });
  assert.equal(g.remaining, 0.5);
});

import { rankCombined } from './ledger.mjs';
const two = (name, g, c, gResetH = 3, cResetH = 3, cWeekly = 0.9) => ({ name, families: {
  gemini: { readAt: NOW, fiveHour: { remaining: g, resetAt: NOW + gResetH * H }, weekly: { remaining: 0.9, resetAt: NOW + 24 * H } },
  claude_gpt: { readAt: NOW, fiveHour: { remaining: c, resetAt: NOW + cResetH * H }, weekly: { remaining: cWeekly, resetAt: NOW + 24 * H } } } });

test('combined: exhausted in either family takes the whole account out', () => {
  const r = rankCombined([two('ok', 0.5, 0.5), two('noClaude', 0.9, 0.02, 3, 2), two('noGemini', 0.03, 0.9, 1)], ['gemini', 'claude_gpt'], NOW);
  assert.deepEqual(r.order, ['ok']);
  assert.equal(r.excluded.find((e) => e.name === 'noClaude').reason, 'claude_gpt:five_hour');
  assert.equal(r.excluded.find((e) => e.name === 'noGemini').reason, 'gemini:five_hour');
  assert.equal(r.excluded.find((e) => e.name === 'noClaude').until, NOW + 2 * H);
});

test('combined: weekly exhaustion in one family excludes the account', () => {
  const r = rankCombined([two('w', 1, 1, 3, 3, 0.0)], ['gemini', 'claude_gpt'], NOW);
  assert.deepEqual(r.order, []); assert.equal(r.excluded[0].reason, 'claude_gpt:weekly');
});

test('combined: a missing family reading is unknown and excludes (fails closed)', () => {
  const a = two('half', 0.9, 0.9); delete a.families.claude_gpt;
  const r = rankCombined([a], ['gemini', 'claude_gpt'], NOW);
  assert.equal(r.excluded[0].status, 'unknown');
});

test('combined: soonest started reset in any family goes first, then scarcer family', () => {
  const r = rankCombined([two('idle', 1, 1, 5, 5), two('gemUsed', 0.6, 1, 2, 5), two('claudeUsed', 1, 0.5, 5, 1)], ['gemini', 'claude_gpt'], NOW);
  assert.deepEqual(r.order, ['claudeUsed', 'gemUsed', 'idle']);
});
