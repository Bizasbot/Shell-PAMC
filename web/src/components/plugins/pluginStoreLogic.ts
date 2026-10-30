import type {
  PluginItem,
  PluginStoreAuthRule,
  PluginStoreAuthTarget,
  PluginStoreAuthType,
} from '../../types/plugin';

function matchesQuery(haystack: Array<string | undefined>, query: string): boolean {
  if (!query) return true;
  return haystack.some((value) => (value ?? '').toLowerCase().includes(query));
}

/** The installed plugins a search leaves, matched on what the card shows. */
export function filterInstalledPlugins(
  plugins: readonly PluginItem[],
  query: string,
): PluginItem[] {
  const needle = query.trim().toLowerCase();
  return plugins.filter((plugin) => {
    return matchesQuery(
      [
        plugin.id, plugin.metadata?.name, plugin.metadata?.author, plugin.oauth_provider,
        ...(plugin.pages ?? []).map((page) => page.label),
      ],
      needle,
    );
  });
}

// ── store settings ──────────────────────────────────────────────────────────

export const PLUGIN_STORE_AUTH_TYPES: readonly PluginStoreAuthType[] = ['bearer', 'github-token', 'basic', 'header', 'none'];
export const PLUGIN_STORE_AUTH_TARGETS: readonly PluginStoreAuthTarget[] = ['registry', 'metadata', 'artifact'];

export type PluginSettingsIssue =
  | { kind: 'source-url'; index: number }
  | { kind: 'source-duplicate'; index: number }
  | { kind: 'rule-match'; index: number }
  | { kind: 'rule-env'; index: number; field: 'token_env' | 'username_env' | 'password_env' | 'header_value_env' }
  | { kind: 'rule-header'; index: number };

const ENVIRONMENT_VARIABLE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/;

export function isRegistryURL(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname !== '' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** The environment variables a rule's type reads; the others are not written. */
export function authRuleEnvFields(type: PluginStoreAuthType): Array<'token_env' | 'username_env' | 'password_env' | 'header_value_env'> {
  if (type === 'bearer' || type === 'github-token') return ['token_env'];
  if (type === 'basic') return ['username_env', 'password_env'];
  if (type === 'header') return ['header_value_env'];
  return [];
}

/**
 * The problems the server would refuse a settings save for, found before it is sent so
 * each one is shown beside the field it concerns. Empty source rows are ignored: they are
 * how the list offers a new line, not a value.
 */
export function validatePluginSettingsDraft(sources: readonly string[], rules: readonly PluginStoreAuthRule[]): PluginSettingsIssue[] {
  const issues: PluginSettingsIssue[] = [];
  const seen = new Set<string>();
  sources.forEach((source, index) => {
    const trimmed = source.trim();
    if (!trimmed) return;
    if (!isRegistryURL(trimmed)) issues.push({ kind: 'source-url', index });
    else if (seen.has(trimmed)) issues.push({ kind: 'source-duplicate', index });
    seen.add(trimmed);
  });
  rules.forEach((rule, index) => {
    if (!rule.match.trim()) issues.push({ kind: 'rule-match', index });
    for (const field of authRuleEnvFields(rule.type)) {
      if (!ENVIRONMENT_VARIABLE.test((rule[field] ?? '').trim())) issues.push({ kind: 'rule-env', index, field });
    }
    if (rule.type === 'header' && !HEADER_NAME.test((rule.header_name ?? '').trim())) {
      issues.push({ kind: 'rule-header', index });
    }
  });
  return issues;
}

/** The settings payload a draft saves: empty source rows dropped, unused variables cleared. */
export function normalizePluginSettingsDraft(sources: readonly string[], rules: readonly PluginStoreAuthRule[]) {
  const storeSources = [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
  const storeAuth = rules.map((rule): PluginStoreAuthRule => {
    const used = new Set(authRuleEnvFields(rule.type));
    return {
      match: rule.match.trim(),
      apply_to: PLUGIN_STORE_AUTH_TARGETS.filter((target) => rule.apply_to.includes(target)),
      type: rule.type,
      token_env: used.has('token_env') ? rule.token_env?.trim() : undefined,
      username_env: used.has('username_env') ? rule.username_env?.trim() : undefined,
      password_env: used.has('password_env') ? rule.password_env?.trim() : undefined,
      header_name: rule.type === 'header' ? rule.header_name?.trim() : undefined,
      header_value_env: used.has('header_value_env') ? rule.header_value_env?.trim() : undefined,
      allow_insecure: rule.allow_insecure,
    };
  });
  return { storeSources, storeAuth };
}
