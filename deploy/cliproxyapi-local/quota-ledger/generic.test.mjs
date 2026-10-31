import test from 'node:test';
import assert from 'node:assert/strict';
import { entryFromQuotaItem, groupByProvider } from './generic.mjs';
import { rank } from './ledger.mjs';

const NOW = 1_000_000_000_000, H = 3600e3;
const item = (provider, name, five, reset5H, weekly = 80, extra = {}) => ({
  provider, name, auth_index: name, disabled: false, observed_at_ms: NOW,
  windows: [
    { id: 'five_hour', period_hours: 5, remaining_percent: five, reset_at_ms: NOW + reset5H * H },
    { id: 'weekly', period_hours: 168, remaining_percent: weekly, reset_at_ms: NOW + 90 * H }],
  ...extra,
});

test('five-hour and weekly windows are read for any provider', () => {
  const e = entryFromQuotaItem(item('codex', 'c1', 60, 2, 55));
  assert.equal(e.fiveHour.remaining, 0.6); assert.equal(e.weekly.remaining, 0.55); assert.equal(e.readAt, NOW);
});

test('Claude-style seven_day id is recognised as the weekly window', () => {
  const it = item('claude', 'k', 75, 2); it.windows[1] = { id: 'seven_day', period_hours: 168, remaining_percent: 53, reset_at_ms: NOW + 90 * H };
  assert.equal(entryFromQuotaItem(it).weekly.remaining, 0.53);
});

test('a provider without a 5h window falls back to its shortest window', () => {
  const it = { provider: 'kimi', name: 'k', observed_at_ms: NOW, windows: [
    { id: 'monthly', period_hours: 720, remaining_percent: 40, reset_at_ms: NOW + 100 * H },
    { id: 'daily', period_hours: 24, remaining_percent: 70, reset_at_ms: NOW + 5 * H }] };
  assert.equal(entryFromQuotaItem(it).fiveHour.remaining, 0.7);
});

test('quota_exceeded forces zero capacity regardless of the windows', () => {
  const e = entryFromQuotaItem(item('claude', 'x', 90, 2, 80, { quota_exceeded: true }));
  assert.equal(e.fiveHour.remaining, 0);
});

test('item with no readable window yields no five-hour reading (ranked unknown)', () => {
  const e = entryFromQuotaItem({ provider: 'xai', name: 'x', observed_at_ms: NOW, windows: [] });
  assert.equal(e.fiveHour, undefined);
  const r = rank([{ name: 'x', families: { default: e } }], 'default', NOW);
  assert.deepEqual(r.order, []); assert.equal(r.excluded[0].status, 'unknown');
});

test('groups are per provider, skip disabled and the antigravity reader', () => {
  const g = groupByProvider([item('codex', 'a', 50, 1), item('codex', 'b', 90, 3), item('claude', 'c', 70, 2),
    item('antigravity', 'ag', 100, 5), item('codex', 'off', 100, 5, 80, { disabled: true })]);
  assert.deepEqual([...g.keys()].sort(), ['claude', 'codex']);
  assert.deepEqual(g.get('codex').map((a) => a.name), ['a', 'b']);
});

test('within one provider the soonest-resetting started account goes first', () => {
  const g = groupByProvider([item('codex', 'fresh', 100, 5), item('codex', 'used', 40, 1.5)]);
  assert.deepEqual(rank(g.get('codex'), 'default', NOW).order, ['used', 'fresh']);
});
