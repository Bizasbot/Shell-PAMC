import test from 'node:test';
import assert from 'node:assert/strict';
import { planPriorities, diffPlan, BASE, EXCLUDED } from './apply.mjs';

const ranking = { order: ['a', 'b', 'c'] };

test('earlier in the order gets a strictly higher priority', () => {
  const p = planPriorities(ranking, ['a', 'b', 'c']);
  assert.ok(p.a > p.b && p.b > p.c);
  assert.equal(p.a, BASE);
});

test('excluded accounts sit below every ranked account', () => {
  const p = planPriorities(ranking, ['a', 'b', 'c', 'x']);
  assert.ok(p.x <= EXCLUDED && p.x < p.c);
});

test('a steady state writes nothing', () => {
  const p = planPriorities(ranking, ['a', 'b', 'c', 'x']);
  assert.deepEqual(diffPlan(p, p), []);
});

test('only changed accounts are written', () => {
  const p = planPriorities(ranking, ['a', 'b', 'c']);
  const d = diffPlan({ ...p, b: 0 }, p);
  assert.deepEqual(d, [{ name: 'b', priority: p.b }]);
});
