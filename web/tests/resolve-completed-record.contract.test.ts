import { describe, expect, it } from 'vitest';
import { resolveCompletedRecord } from '../src/pages/oauthManagement/oauthWorkspaceLogic';

const fp = (r: { key: string }) => `fp-${r.key}`;
describe('resolveCompletedRecord', () => {
  it('picks the single new key', () => {
    expect(resolveCompletedRecord([{ key: 'a' }, { key: 'b' }], new Map([['a', 'fp-a']]), fp)).toBe('b');
  });
  it('picks the single changed fingerprint', () => {
    expect(resolveCompletedRecord([{ key: 'a' }, { key: 'b' }], new Map([['a', 'old'], ['b', 'fp-b']]), fp)).toBe('a');
  });
  it('re-link of the sole credential with nothing changed resolves to it', () => {
    expect(resolveCompletedRecord([{ key: 'a' }], new Map([['a', 'fp-a']]), fp)).toBe('a');
  });
  it('stays ambiguous with several unchanged credentials', () => {
    expect(resolveCompletedRecord([{ key: 'a' }, { key: 'b' }], new Map([['a', 'fp-a'], ['b', 'fp-b']]), fp)).toBeNull();
  });
});
