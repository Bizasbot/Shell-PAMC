import { canonicalModelName, type RoutingModel } from './usageRouting';

/** Where the read-only profile sidecar listens (loopback only, GET /models). */
export const PROFILE_MODELS_URL = 'http://127.0.0.1:18081/models';

/** `oh-my-cpa/pv-claude-opus-5-5` -> `gemini-claude-opus-5.5`, the name the panel displays. */
export function profileModelName(raw: string): string {
  const slash = raw.lastIndexOf('/');
  return canonicalModelName(slash >= 0 ? raw.slice(slash + 1) : raw);
}

export function allowedProfileModels(ids: readonly string[] | undefined): Set<string> | undefined {
  if (!ids || ids.length === 0) return undefined;
  // A profile picks a model, not a route: `pv-gpt-6-1-sol` (Gemini-served, shown as
  // `gemini-gpt-6.1-sol`) must also admit the same model served directly by OpenAI/Anthropic
  // (`gpt-6.1-sol`), otherwise the direct subscription rows vanish from the panel.
  const names = new Set<string>();
  for (const id of ids) {
    const name = profileModelName(id);
    if (!name) continue;
    names.add(name);
    names.add(name.replace(/^gemini-(?=claude|gpt)/i, ''));
  }
  return names;
}

/**
 * Display-only filter: keep the models some profile selects. Without a readable profile list
 * the model is returned untouched (never an empty panel); routing is never affected.
 */
export function filterRoutingByProfiles(model: RoutingModel, allowed: ReadonlySet<string> | undefined): RoutingModel {
  if (!allowed) return model;
  const models = model.models.filter((row) => allowed.has(row.name));
  const kept = new Set(models.map((row) => row.id));
  return { ...model, models, routes: model.routes.filter((route) => kept.has(route.modelId)), hiddenModels: 0 };
}

export async function fetchProfileModels(signal?: AbortSignal): Promise<string[] | undefined> {
  try {
    const res = await fetch(PROFILE_MODELS_URL, { signal, cache: 'no-store' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { models?: unknown };
    return Array.isArray(body.models) ? body.models.filter((m): m is string => typeof m === 'string') : undefined;
  } catch {
    return undefined;
  }
}
