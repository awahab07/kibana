/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  EuiBadge,
  EuiCallOut,
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexGrid,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPageTemplate,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { CoreStart } from '@kbn/core/public';
import type { AipmFeatureDescriptor } from '@kbn/aipm-schema-catalog';
import type { NavigationPublicPluginStart } from '@kbn/navigation-plugin/public';
import {
  AIPM_BOOTSTRAP_API_PATH,
  AIPM_FEATURE_OVERVIEW_API_PATH,
  EXPERIMENTS_ARTIFACT_LABEL,
  PLAYGROUND_SURFACE_LABEL,
  PLUGIN_ID,
  PLUGIN_NAME,
  type AipmBootstrapRouteResponse,
  type AipmFeatureOverviewRouteResponse,
} from '../../common';
import { AipmFeaturePanel } from './feature_panel';

interface AipmAppDeps {
  basename: string;
  notifications: CoreStart['notifications'];
  http: CoreStart['http'];
  navigation: NavigationPublicPluginStart;
}

export const AipmApp = ({ basename, notifications, http, navigation }: AipmAppDeps) => {
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
      <navigation.ui.TopNavMenu appName={PLUGIN_ID} showSearchBar={false} useDefaultBehaviors />
      <EuiPageTemplate grow={false} restrictWidth={1200}>
        <EuiPageTemplate.Header
          pageTitle={PLUGIN_NAME}
          description={i18n.translate('xpack.aipm.pageDescription', {
            defaultMessage:
              'Embeddable-first showcase panels for AI observability, rooted in shared schema descriptors and synthtrace-backed evidence.',
          })}
        />
        <EuiPageTemplate.Section>
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
              {i18n.translate('xpack.aipm.firstSurfaceDescription', {
                defaultMessage:
                  'The first wave now exposes the top showcase features as portable panel content that can back the AIPM app, dashboards, Agent Builder attachments, and MCP-facing views.',
              })}
            </p>
          </EuiCallOut>

          <EuiSpacer size="l" />

          <EuiFlexGroup alignItems="stretch" wrap>
            <EuiFlexItem>
              <EuiPanel hasBorder hasShadow={false}>
                <EuiTitle size="s">
                  <h2>
                    {i18n.translate('xpack.aipm.sourceTiersTitle', {
                      defaultMessage: 'Source tiers',
                    })}
                  </h2>
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
                  <h2>
                    {i18n.translate('xpack.aipm.dataRolesTitle', {
                      defaultMessage: 'Data roles',
                    })}
                  </h2>
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

            <EuiFlexItem>
              <EuiPanel hasBorder hasShadow={false}>
                <EuiTitle size="s">
                  <h2>
                    {i18n.translate('xpack.aipm.portableFeatureCountTitle', {
                      defaultMessage: 'Portable features',
                    })}
                  </h2>
                </EuiTitle>
                <EuiSpacer size="m" />
                {isLoading ? (
                  <EuiLoadingSpinner size="m" />
                ) : (
                  <EuiDescriptionList
                    compressed
                    listItems={[
                      {
                        title: i18n.translate('xpack.aipm.catalogSizeTitle', {
                          defaultMessage: 'Catalog size',
                        }),
                        description: String(featureCatalog.length),
                      },
                      {
                        title: i18n.translate('xpack.aipm.deliveryAdaptersTitle', {
                          defaultMessage: 'Delivery adapters',
                        }),
                        description: 'app, dashboard, Agent Builder, MCP',
                      },
                      {
                        title: i18n.translate('xpack.aipm.updatedAtTitle', {
                          defaultMessage: 'Overview refreshed',
                        }),
                        description: featureOverview?.updatedAt ?? 'n/a',
                      },
                    ]}
                  />
                )}
              </EuiPanel>
            </EuiFlexItem>
          </EuiFlexGroup>

          <EuiSpacer size="l" />

          <EuiPanel hasBorder hasShadow={false}>
            <EuiTitle size="s">
              <h2>
                {i18n.translate('xpack.aipm.bootstrapDetailsTitle', {
                  defaultMessage: 'Feature contract',
                })}
              </h2>
            </EuiTitle>
            <EuiSpacer size="m" />
            {isLoading ? (
              <EuiLoadingSpinner size="m" />
            ) : (
              <EuiDescriptionList
                listItems={[
                  {
                    title: i18n.translate('xpack.aipm.bootstrapPathTitle', {
                      defaultMessage: 'Mounted base path',
                    }),
                    description: basename,
                  },
                  {
                    title: i18n.translate('xpack.aipm.schemaPackageTitle', {
                      defaultMessage: 'Shared schema package',
                    }),
                    description: bootstrap?.schemaPackage ?? '',
                  },
                  {
                    title: i18n.translate('xpack.aipm.firstSurfaceLabelTitle', {
                      defaultMessage: 'First interactive surface',
                    }),
                    description: bootstrap?.firstSurface ?? '',
                  },
                  {
                    title: i18n.translate('xpack.aipm.savedArtifactLabelTitle', {
                      defaultMessage: 'Saved run artifact',
                    }),
                    description: bootstrap?.firstSavedArtifact ?? '',
                  },
                  {
                    title: i18n.translate('xpack.aipm.featureCountTitle', {
                      defaultMessage: 'Top showcase features',
                    }),
                    description: String(featureCatalog.length),
                  },
                ]}
              />
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiTitle size="s">
            <h2>
              {i18n.translate('xpack.aipm.featurePanelsTitle', {
                defaultMessage: 'Top 10 showcase features',
              })}
            </h2>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiText size="s" color="subdued">
            <p>
              {i18n.translate('xpack.aipm.featurePanelsDescription', {
                defaultMessage:
                  'Each panel is designed as embeddable-safe content first, then composed into the AIPM page. The same evidence should remain reusable for dashboards, Agent Builder, and MCP surfaces.',
              })}
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
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </>
  );
};
