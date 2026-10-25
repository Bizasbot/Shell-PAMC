import { expect, it } from 'vitest';
import { buildRoutingModel, canonicalModelName } from '../src/types/usageRouting';
import type { ManagementAuthFile } from '../src/types/managementAuthFile';

it('collapses aliases, account slots and dashed versions into one short name', () => {
  expect(canonicalModelName('pv-vc001-gemini-3-8-flash-high')).toBe('gemini-3.8-flash-high');
  expect(canonicalModelName('vc002/gemini-3.8-flash-high')).toBe('gemini-3.8-flash-high');
  expect(canonicalModelName('vc002/claude-opus-4-6-thinking')).toBe('gemini-claude-opus-4.6-thinking');
  expect(canonicalModelName('pv-claude-sonnet-5-5')).toBe('gemini-claude-sonnet-5.5');
  expect(canonicalModelName('pv-gpt-6-luna')).toBe('gemini-gpt-6-luna');
  expect(canonicalModelName('claude-opus-5-5')).toBe('claude-opus-5-5');
  expect(canonicalModelName('gpt-oss-120b-medium')).toBe('gpt-oss-120b-medium');
});

it('lists one row per model across many accounts and keeps disabled accounts out', () => {
  const file = (n: string, ids: string[], disabled = false) =>
    ({ name: n, auth_index: n, provider: 'antigravity', disabled, models: ids.map((id) => ({ id })) }) as unknown as ManagementAuthFile;
  const model = buildRoutingModel([], [], Date.now(), [
    file('a', ['vc001/gemini-3-flash', 'gemini-3-flash']),
    file('b', ['vc002/gemini-3-flash', 'pv-vc002-gemini-3-flash']),
    file('c', ['vc003/only-disabled'], true),
  ]);
  expect(model.models.map((m) => m.name)).toEqual(['gemini-3-flash']);
  expect(model.targets).toHaveLength(2);
});
