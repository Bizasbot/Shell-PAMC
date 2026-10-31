// Turns a ranking into CPA priorities. Highest priority tier is used first (fill-first inside a tier).
// Only the `priority` field is written; credentials are never disabled, so a wrong reading
// can lower an account's turn but never lock it out.

export const BASE = 100;       // first account in the order
export const EXCLUDED = -100;  // out of the pool until its window refills

// rank() result + all account names -> { name: priority }. Order is strict: one account per tier,
// so fill-first never has two candidates to alternate between.
export function planPriorities(ranking, allNames) {
  const plan = {};
  ranking.order.forEach((name, i) => { plan[name] = BASE - i; });
  const lowest = BASE - ranking.order.length;
  for (const name of allNames) if (!(name in plan)) plan[name] = Math.min(EXCLUDED, lowest - 1);
  return plan;
}

// Only write what changed, so a steady state produces zero requests.
export function diffPlan(current, plan) {
  return Object.entries(plan).filter(([name, p]) => current[name] !== p).map(([name, priority]) => ({ name, priority }));
}
