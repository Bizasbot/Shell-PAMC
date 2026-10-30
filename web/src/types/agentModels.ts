import { gatewayCallPointOf, type GatewayModelItem } from './gatewayModels';

/** Models the Agent offers per subscription, fastest and most direct first. */
export const AGENT_MODELS_PER_SUBSCRIPTION = 2;

const AGENT_MODEL_PREFERENCE: readonly (readonly string[])[] = [
  // Claude
  ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
  // GPT
  ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-6-astra', 'gpt-5.6-terra'],
  // Antigravity (Gemini)
  ['gemini-3.5-flash-lite', 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash-high'],
];

/** Keeps at most two quick-answer models per subscription, in the preference order above. */
export function curateAgentModels<T extends GatewayModelItem>(models: readonly T[] | undefined): T[] | undefined {
  if (!models) return models as undefined;
  const byLabel = new Map<string, T>();
  for (const item of models) for (const key of [item.id, item.call_point, gatewayCallPointOf(item)]) if (key && !byLabel.has(key)) byLabel.set(key, item);
  return AGENT_MODEL_PREFERENCE.flatMap(family =>
    family.flatMap(label => byLabel.get(label) ?? []).slice(0, AGENT_MODELS_PER_SUBSCRIPTION));
}
