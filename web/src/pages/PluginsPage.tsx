import { ActionMenu } from '../components/common/ActionMenu';
import React from 'react';
import { Button, Segmented } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useT } from '../i18n';
import { isDemoMode } from '../types/demoMode';
import type { PluginItem } from '../types/plugin';
import { PageHeader } from '../components/common/PageHeader';
import { RefreshButton } from '../components/common/RefreshButton';
import { InstalledPluginsPanel } from '../components/plugins/InstalledPluginsPanel';
import { PluginSettingsPanel } from '../components/plugins/PluginSettingsPanel';
import { PluginConfigDrawer } from '../components/plugins/PluginConfigDrawer';
import styles from '../components/plugins/Plugins.module.css';
import { LoadFailure, Notice } from '../components/feedback';
import { Panel } from '../components/common/Panel';

const PLUGIN_TABS = ['installed', 'settings'] as const;
type PluginTab = (typeof PLUGIN_TABS)[number];

const TAB_PATHS: Record<PluginTab, string> = {
  installed: '/plugins',
  settings: '/plugins/settings',
};

function tabOfPath(pathname: string): PluginTab {
  const segment = pathname.replace(/\/+$/, '').split('/').pop();
  return segment === 'settings' ? segment : 'installed';
}

function isPluginTab(value: string | null): value is PluginTab {
  return PLUGIN_TABS.includes(value as PluginTab);
}

/**
 * Plugin management: what is installed, and how the plugin system itself is configured,
 * on one page.
 *
 * The two tabs have their own address (`/plugins`, `/plugins/settings`), so the navigation
 * can list both and either can be linked to; `?plugin=<id>` opens that plugin's settings.
 */
export const PluginsPage: React.FC = () => {
  const t = useT();
  const isDemo = isDemoMode();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOfPath(location.pathname);

  // `?tab=` was the tab's address before each tab had a path; links that carry it still land.
  const legacyTab = searchParams.get('tab');
  React.useEffect(() => {
    if (legacyTab === null) return;
    const params = new URLSearchParams(searchParams);
    params.delete('tab');
    const query = params.toString();
    navigate(`${TAB_PATHS[isPluginTab(legacyTab) ? legacyTab : 'installed']}${query ? `?${query}` : ''}`, { replace: true });
  }, [legacyTab, navigate, searchParams]);

  const [configuring, setConfiguring] = React.useState<PluginItem | null>(null);

  const pluginsQuery = useQuery({
    queryKey: ['management-plugins'],
    queryFn: api.getPlugins,
    staleTime: 15000,
  });

  const plugins = React.useMemo(() => pluginsQuery.data?.plugins ?? [], [pluginsQuery.data]);
  const isSystemEnabled = pluginsQuery.data?.plugins_enabled ?? true;

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      mutate(params);
      return params;
    }, { replace: true });
  };

  const selectTab = (next: PluginTab) => navigate(TAB_PATHS[next]);

  // `?plugin=<id>` opens that plugin's settings once the list has it.
  const requestedPlugin = searchParams.get('plugin');
  React.useEffect(() => {
    if (!requestedPlugin || !pluginsQuery.data) return;
    const match = pluginsQuery.data.plugins.find((plugin) => plugin.id === requestedPlugin);
    if (match) setConfiguring(match);
    updateParams((params) => params.delete('plugin'));
    // Only a new request or a new list can open the editor; `updateParams` is recreated
    // every render and is deliberately not a trigger.
  }, [requestedPlugin, pluginsQuery.data]);

  const refresh = () => {
    void pluginsQuery.refetch();
    if (tab === 'settings') void queryClient.invalidateQueries({ queryKey: ['management-plugin-settings'] });
  };
  const isRefreshing = pluginsQuery.isFetching;

  const effectiveCount = plugins.filter((plugin) => plugin.effective_enabled).length;

  return (
    <div className="terminal-page terminal-page-stack plugins-page">
      <PageHeader
        title={t('nav.plugins')}
        mobileActions={(
          <>
            <Segmented className="plugins-tabs" value={tab} onChange={(value) => selectTab(value as PluginTab)} options={[
              { value: 'installed', label: t('plugin.tab_installed', { n: plugins.length }) },
              { value: 'settings', label: t('plugin.tab_settings') },
            ]} />
            <ActionMenu><RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} /></ActionMenu>
          </>
        )}
        actions={(
          <>
            <Segmented
              className="plugins-tabs"
              value={tab}
              onChange={(value) => selectTab(value as PluginTab)}
              options={[
                { value: 'installed', label: t('plugin.tab_installed', { n: plugins.length }) },
                { value: 'settings', label: t('plugin.tab_settings') },
              ]}
            />
            <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
          </>
        )}
      >
        {pluginsQuery.data && (
          <div className={styles['status-strip']} data-plugin-status>
            <span>
              {t('plugin.status_system')}
              <span className={styles['status-strip-value']}>
                {isSystemEnabled ? t('plugin.system_enabled') : t('plugin.system_disabled')}
              </span>
            </span>
            <span>
              {t('plugin.status_dir')}
              <code className={styles['status-strip-path']}>{pluginsQuery.data.plugins_dir || 'plugins'}</code>
            </span>
            <span>
              {t('plugin.status_running')}
              <span className={styles['status-strip-value']}>{effectiveCount} / {plugins.length}</span>
            </span>
          </div>
        )}
      </PageHeader>

      {pluginsQuery.data && !isSystemEnabled && tab !== 'settings' && (
        <Notice
          tone="warning"
          title={t('plugin.system_disabled_title')}
          description={t('plugin.system_disabled_desc')}
          action={<Button size="small" onClick={() => selectTab('settings')}>{t('plugin.open_settings')}</Button>}
        />
      )}

      {pluginsQuery.isError && (
        <LoadFailure
          title={t('common.load_failed_title')}
          error={pluginsQuery.error}
          onRetry={() => void pluginsQuery.refetch()}
        />
      )}

      {tab === 'installed' && (
        <Panel>
          <InstalledPluginsPanel
            plugins={plugins}
            isLoading={pluginsQuery.isLoading}
            isPluginSystemEnabled={isSystemEnabled}
            isDemo={isDemo}
            onConfigure={setConfiguring}
          />
        </Panel>
      )}
      {tab === 'settings' && <PluginSettingsPanel isDemo={isDemo} />}

      <PluginConfigDrawer plugin={configuring} isDemo={isDemo} onClose={() => setConfiguring(null)} />
    </div>
  );
};
