/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { AppMountParameters, CoreStart } from '@kbn/core/public';
import {
  EuiBadge,
  EuiCallOut,
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexGrid,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSideNav,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { AipmFeatureDescriptor } from '@kbn/aipm-schema-catalog';
import type { NavigationPublicPluginStart } from '@kbn/navigation-plugin/public';
import { Route, Router, Routes } from '@kbn/shared-ux-router';
import { Redirect, useLocation, useParams } from 'react-router-dom';
import {
  AIPM_BOOTSTRAP_API_PATH,
  AIPM_FEATURE_OVERVIEW_API_PATH,
  EXPERIMENTS_ARTIFACT_LABEL,
  PLAYGROUND_SURFACE_LABEL,
  PLUGIN_ID,
  PLUGIN_NAME,
  type AipmBootstrapRouteResponse,
  type AipmCuratedEntityCounts,
  type AipmFeatureOverviewRouteResponse,
} from '../../common';
import { AipmAgentMap } from './curated/agent_map';
import { formatCurrency, formatDurationUs, formatRating } from './curated/formatters';
import { AipmSessionTimeline } from './curated/session_timeline';
import { AipmTraceSelectorPanel } from './curated/trace_selector_panel';
import { AipmTraceSummaryPanel } from './curated/trace_summary_panel';
import { AipmTraceWaterfall } from './curated/trace_waterfall';
import { useCuratedTraceData } from './curated/use_curated_trace_data';
import { AipmFeaturePanel } from './feature_panel';

interface AipmAppDeps {
  basename: string;
  history: AppMountParameters['history'];
  notifications: CoreStart['notifications'];
  http: CoreStart['http'];
  navigation: NavigationPublicPluginStart;
}

const buildEntityCountCards = (entityCounts: AipmCuratedEntityCounts) => [
  {
    title: 'Curated traces',
    description: String(entityCounts.traces),
  },
  {
    title: 'Services',
    description: String(entityCounts.services),
  },
  {
    title: 'Models',
    description: String(entityCounts.models),
  },
  {
    title: 'MCP servers',
    description: String(entityCounts.mcpServers),
  },
];

const AipmOverviewPage = ({
  basename,
  http,
  notifications,
}: Pick<AipmAppDeps, 'basename' | 'http' | 'notifications'>) => {
  const [bootstrap, setBootstrap] = useState<AipmBootstrapRouteResponse | null>(null);
  const [featureOverview, setFeatureOverview] = useState<AipmFeatureOverviewRouteResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  const featureOverviewById = useMemo(
    () => new Map((featureOverview?.features ?? []).map((feature) => [feature.id, feature])),
    [featureOverview]
  );

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [bootstrapResponse, overviewResponse] = await Promise.all([
          http.get<AipmBootstrapRouteResponse>(AIPM_BOOTSTRAP_API_PATH),
          http.get<AipmFeatureOverviewRouteResponse>(AIPM_FEATURE_OVERVIEW_API_PATH),
        ]);

        if (isMounted) {
          setBootstrap(bootstrapResponse);
          setFeatureOverview(overviewResponse);
        }
      } catch (error) {
        if (isMounted) {
          notifications.toasts.addDanger(
            i18n.translate('xpack.aipm.bootstrapErrorMessage', {
              defaultMessage: 'Unable to load the AIPM bootstrap payload.',
            })
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [http, notifications]);

  const buildApmHref = (kuery: string) =>
    http.basePath.prepend(`/app/apm/services?kuery=${encodeURIComponent(kuery)}`);

  const featureCatalog = bootstrap?.featureCatalog ?? [];

  return (
    <>
      <EuiTitle size="l">
        <h1>{PLUGIN_NAME}</h1>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiText color="subdued">
        <p>
          Embeddable-first showcase panels and curated AI workflow experiences, rooted in shared
          schema descriptors and synthtrace-backed evidence.
        </p>
      </EuiText>
      <EuiSpacer size="l" />

      <EuiCallOut
        title={i18n.translate('xpack.aipm.firstSurfaceTitle', {
          defaultMessage: '{playground} stays mutable, {experiments} stay durable',
          values: {
            playground: PLAYGROUND_SURFACE_LABEL,
            experiments: EXPERIMENTS_ARTIFACT_LABEL,
          },
        })}
        color="primary"
        iconType="beaker"
      >
        <p>
          The curated traces and agent map now sit alongside the top showcase panels so the same
          evidence can drive the AIPM app, dashboards, Agent Builder attachments, and MCP-facing
          views.
        </p>
      </EuiCallOut>

      <EuiSpacer size="l" />

      <EuiFlexGrid columns={2} gutterSize="l">
        <EuiFlexItem>
          <EuiPanel hasBorder hasShadow={false}>
            <EuiTitle size="s">
              <h2>Curated experiences</h2>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiDescriptionList
              listItems={[
                {
                  title: 'Trace waterfall',
                  description:
                    'A curated execution view from user prompt through tools, MCP, models, evaluation, and feedback.',
                },
                {
                  title: 'Agent map',
                  description:
                    'A semantic topology view that turns one execution into an explorable LLM infrastructure story.',
                },
              ]}
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder hasShadow={false}>
            <EuiTitle size="s">
              <h2>Feature contract</h2>
            </EuiTitle>
            <EuiSpacer size="m" />
            {isLoading ? (
              <EuiLoadingSpinner size="m" />
            ) : (
              <EuiDescriptionList
                listItems={[
                  {
                    title: 'Mounted base path',
                    description: basename,
                  },
                  {
                    title: 'Shared schema package',
                    description: bootstrap?.schemaPackage ?? '',
                  },
                  {
                    title: 'Portable feature count',
                    description: String(featureCatalog.length),
                  },
                  {
                    title: 'Overview refreshed',
                    description: featureOverview?.updatedAt ?? 'n/a',
                  },
                ]}
              />
            )}
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGrid>

      <EuiSpacer size="l" />

      <EuiFlexGroup alignItems="stretch" wrap>
        <EuiFlexItem>
          <EuiPanel hasBorder hasShadow={false}>
            <EuiTitle size="s">
              <h2>Source tiers</h2>
            </EuiTitle>
            <EuiSpacer size="m" />
            {isLoading ? (
              <EuiLoadingSpinner size="m" />
            ) : (
              <EuiFlexGroup gutterSize="s" wrap>
                {(bootstrap?.sourceTiers ?? []).map((tier) => (
                  <EuiFlexItem grow={false} key={tier}>
                    <EuiBadge color="hollow">{tier}</EuiBadge>
                  </EuiFlexItem>
                ))}
              </EuiFlexGroup>
            )}
          </EuiPanel>
        </EuiFlexItem>

        <EuiFlexItem>
          <EuiPanel hasBorder hasShadow={false}>
            <EuiTitle size="s">
              <h2>Data roles</h2>
            </EuiTitle>
            <EuiSpacer size="m" />
            {isLoading ? (
              <EuiLoadingSpinner size="m" />
            ) : (
              <EuiFlexGroup gutterSize="s" wrap>
                {(bootstrap?.dataRoles ?? []).map((role) => (
                  <EuiFlexItem grow={false} key={role}>
                    <EuiBadge color="accent">{role}</EuiBadge>
                  </EuiFlexItem>
                ))}
              </EuiFlexGroup>
            )}
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiTitle size="s">
        <h2>Top 10 showcase features</h2>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiText size="s" color="subdued">
        <p>
          Each panel is designed as embeddable-safe content first, then composed into the AIPM page.
          The same evidence should remain reusable for dashboards, Agent Builder, and MCP surfaces.
        </p>
      </EuiText>
      <EuiSpacer size="l" />
      {isLoading ? (
        <EuiLoadingSpinner size="xl" />
      ) : (
        <EuiFlexGrid columns={2} gutterSize="l">
          {featureCatalog.map((descriptor: AipmFeatureDescriptor) => (
            <EuiFlexItem key={descriptor.id}>
              <AipmFeaturePanel
                descriptor={descriptor}
                overview={featureOverviewById.get(descriptor.id)}
                buildApmHref={buildApmHref}
              />
            </EuiFlexItem>
          ))}
        </EuiFlexGrid>
      )}
    </>
  );
};

const AipmTracesPage = ({
  http,
  history,
  notifications,
}: Pick<AipmAppDeps, 'http' | 'history' | 'notifications'>) => {
  const { traceId } = useParams<{ traceId?: string }>();
  const { list, detail, isListLoading, isDetailLoading } = useCuratedTraceData({
    http,
    notifications,
    traceId,
  });

  useEffect(() => {
    if (!traceId && list?.traces[0]) {
      history.replace(`/traces/${list.traces[0].traceId}`);
    }
  }, [history, list, traceId]);

  const buildApmHref = (apmQuery: string) =>
    http.basePath.prepend(`/app/apm/services?kuery=${encodeURIComponent(apmQuery)}`);

  return (
    <>
      <EuiTitle size="l">
        <h1>Curated traces</h1>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiText color="subdued">
        <p>
          AIPM trace explorer with one curated full-stack journey from user prompt through
          guardrails, tools, MCP fan-out, downstream services, answer synthesis, LLM judge scoring,
          and user feedback.
        </p>
      </EuiText>
      <EuiSpacer size="l" />

      {list ? (
        <EuiFlexGrid columns={4} gutterSize="m">
          {buildEntityCountCards(list.entityCounts).map((item) => (
            <EuiFlexItem key={item.title}>
              <EuiPanel hasBorder hasShadow={false}>
                <EuiDescriptionList
                  compressed
                  listItems={[{ title: item.title, description: item.description }]}
                />
              </EuiPanel>
            </EuiFlexItem>
          ))}
        </EuiFlexGrid>
      ) : null}

      <EuiSpacer size="l" />

      <EuiFlexGroup alignItems="flexStart" gutterSize="l">
        <EuiFlexItem grow={false} style={{ width: 320 }}>
          <AipmTraceSelectorPanel
            traces={list?.traces ?? []}
            selectedTraceId={traceId}
            isLoading={isListLoading}
            onSelectTrace={(nextTraceId) => history.push(`/traces/${nextTraceId}`)}
          />
        </EuiFlexItem>
        <EuiFlexItem>
          {isDetailLoading || !detail ? (
            <EuiPanel hasBorder hasShadow={false}>
              <EuiLoadingSpinner size="xl" />
            </EuiPanel>
          ) : (
            <>
              <AipmTraceSummaryPanel trace={detail.trace} buildApmHref={buildApmHref} />
              <EuiSpacer size="l" />
              <AipmTraceWaterfall items={detail.waterfall} />
              <EuiSpacer size="l" />
              <AipmSessionTimeline events={detail.sessionEvents} />
            </>
          )}
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};

const AipmAgentMapPage = ({
  http,
  history,
  notifications,
}: Pick<AipmAppDeps, 'http' | 'history' | 'notifications'>) => {
  const { traceId } = useParams<{ traceId?: string }>();
  const { list, detail, isListLoading, isDetailLoading } = useCuratedTraceData({
    http,
    notifications,
    traceId,
  });

  useEffect(() => {
    if (!traceId && list?.traces[0]) {
      history.replace(`/agent-map/${list.traces[0].traceId}`);
    }
  }, [history, list, traceId]);

  const buildApmHref = (apmQuery: string) =>
    http.basePath.prepend(`/app/apm/services?kuery=${encodeURIComponent(apmQuery)}`);

  return (
    <>
      <EuiTitle size="l">
        <h1>AIPM agent map</h1>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiText color="subdued">
        <p>
          A semantic execution map that turns one LLM transaction into a rich topology story with
          nodes for the prompt, agent, guardrails, models, tools, MCP server, downstream services,
          LLM judge, and user feedback.
        </p>
      </EuiText>
      <EuiSpacer size="l" />

      <EuiFlexGroup alignItems="flexStart" gutterSize="l">
        <EuiFlexItem grow={false} style={{ width: 320 }}>
          <AipmTraceSelectorPanel
            traces={list?.traces ?? []}
            selectedTraceId={traceId}
            isLoading={isListLoading}
            onSelectTrace={(nextTraceId) => history.push(`/agent-map/${nextTraceId}`)}
          />
        </EuiFlexItem>
        <EuiFlexItem>
          {isDetailLoading || !detail ? (
            <EuiPanel hasBorder hasShadow={false}>
              <EuiLoadingSpinner size="xl" />
            </EuiPanel>
          ) : (
            <>
              <EuiFlexGrid columns={4} gutterSize="m">
                <EuiFlexItem>
                  <EuiPanel hasBorder hasShadow={false}>
                    <EuiDescriptionList
                      compressed
                      listItems={[
                        {
                          title: 'Total cost',
                          description: formatCurrency(detail.trace.totalCost),
                        },
                      ]}
                    />
                  </EuiPanel>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiPanel hasBorder hasShadow={false}>
                    <EuiDescriptionList
                      compressed
                      listItems={[
                        {
                          title: 'Latency',
                          description: formatDurationUs(detail.trace.durationUs),
                        },
                      ]}
                    />
                  </EuiPanel>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiPanel hasBorder hasShadow={false}>
                    <EuiDescriptionList
                      compressed
                      listItems={[
                        {
                          title: 'LLM judge',
                          description:
                            detail.trace.evaluationScore !== undefined
                              ? `${detail.trace.evaluationScore.toFixed(2)}`
                              : 'n/a',
                        },
                      ]}
                    />
                  </EuiPanel>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiPanel hasBorder hasShadow={false}>
                    <EuiDescriptionList
                      compressed
                      listItems={[
                        {
                          title: 'User rating',
                          description: formatRating(detail.trace.userRating),
                        },
                      ]}
                    />
                  </EuiPanel>
                </EuiFlexItem>
              </EuiFlexGrid>
              <EuiSpacer size="l" />
              <AipmAgentMap
                nodes={detail.map.nodes}
                edges={detail.map.edges}
                buildApmHref={buildApmHref}
              />
              <EuiSpacer size="l" />
              <AipmTraceSummaryPanel trace={detail.trace} buildApmHref={buildApmHref} />
            </>
          )}
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};

const AipmShell = ({ basename, history, notifications, http, navigation }: AipmAppDeps) => {
  const location = useLocation();

  const sideNavItems = [
    {
      id: 'overview',
      name: 'Overview',
      isSelected: location.pathname === '/',
      onClick: () => history.push('/'),
    },
    {
      id: 'traces',
      name: 'Traces',
      isSelected: location.pathname.startsWith('/traces'),
      onClick: () => history.push('/traces'),
    },
    {
      id: 'agentMap',
      name: 'Agent map',
      isSelected: location.pathname.startsWith('/agent-map'),
      onClick: () => history.push('/agent-map'),
    },
  ];

  return (
    <>
      <navigation.ui.TopNavMenu appName={PLUGIN_ID} showSearchBar={false} useDefaultBehaviors />
      <div style={{ padding: 24 }}>
        <EuiFlexGroup alignItems="flexStart" gutterSize="l">
          <EuiFlexItem grow={false} style={{ width: 260 }}>
            <EuiPanel hasBorder hasShadow={false}>
              <EuiTitle size="xs">
                <h2>Navigation</h2>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiSideNav items={sideNavItems} />
              <EuiSpacer size="m" />
              <EuiText size="xs" color="subdued">
                <p>
                  Curated routes build on reusable evidence so the same visuals can later power
                  dashboards, Agent Builder, and MCP surfaces.
                </p>
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
          <EuiFlexItem>
            <Routes enableExecutionContextTracking={true}>
              <Route exact path="/">
                <AipmOverviewPage basename={basename} http={http} notifications={notifications} />
              </Route>
              <Route exact path="/traces/:traceId?">
                <AipmTracesPage http={http} history={history} notifications={notifications} />
              </Route>
              <Route exact path="/agent-map/:traceId?">
                <AipmAgentMapPage http={http} history={history} notifications={notifications} />
              </Route>
              <Route component={() => <Redirect to="/" />} />
            </Routes>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
    </>
  );
};

export const AipmApp = ({ basename, history, notifications, http, navigation }: AipmAppDeps) => {
  return (
    <Router history={history}>
      <AipmShell
        basename={basename}
        history={history}
        notifications={notifications}
        http={http}
        navigation={navigation}
      />
    </Router>
  );
};
