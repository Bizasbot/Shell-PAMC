import { describe, expect, it } from 'vitest';
import { allowedProfileModels, filterRoutingByProfiles, profileModelName } from '../src/types/profileModels';
import type { RoutingModel } from '../src/types/usageRouting';

const row = (name: string) => ({ id: `model:${name}`, name, requests: 0, failures: 0, lastAtMs: 0, latencyMs: 0 });
const base = (names: string[]) => ({ models: names.map(row), targets: [], routes: names.map((n, i) => ({ modelId: `model:${n}`, lastId: i, attempts: [] })), attempts: 0, hiddenModels: 3, hiddenTargets: 0 }) as unknown as RoutingModel;

describe('profile model filter', () => {
  it('maps profile ids to the displayed name', () => {
    expect(profileModelName('shell-pamc/pv-claude-opus-5-5')).toBe('gemini-claude-opus-5.5');
    expect(profileModelName('shell-pamc/claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
    expect(profileModelName('shell-pamc/pv-vc001-gemini-3-5-flash-lite')).toBe('gemini-3.5-flash-lite');
  });
  it('keeps only profile models and their routes', () => {
    const allowed = allowedProfileModels(['shell-pamc/pv-claude-opus-5-5']);
    const out = filterRoutingByProfiles(base(['gemini-claude-opus-5.5', 'gpt-image-2', 'gpt-oss-120b']), allowed);
    expect(out.models.map((m) => m.name)).toEqual(['gemini-claude-opus-5.5']);
    expect(out.routes).toHaveLength(1);
    expect(out.hiddenModels).toBe(0);
  });
  it('shows everything when no profile list is available', () => {
    const m = base(['a', 'b']);
    expect(filterRoutingByProfiles(m, allowedProfileModels(undefined))).toBe(m);
    expect(filterRoutingByProfiles(m, allowedProfileModels([]))).toBe(m);
  });
});

describe('direct subscriptions', () => {
  it('a routed pv-gpt profile entry also admits the directly served gpt model', async () => {
    const { allowedProfileModels } = await import('../src/types/profileModels');
    const allowed = allowedProfileModels(['shell-pamc/pv-gpt-6-1-sol', 'shell-pamc/pv-claude-opus-5-5'])!;
    expect(allowed.has('gpt-6.1-sol')).toBe(true);
    expect(allowed.has('gemini-gpt-6.1-sol')).toBe(true);
    expect(allowed.has('claude-opus-5.5')).toBe(true);
    expect(allowed.has('gpt-6-astra')).toBe(false);
  });
});
