/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiBadge,
  EuiButtonEmpty,
  EuiDescriptionList,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiPanel,
  EuiSpacer,
  EuiStat,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import type { AipmFeatureDescriptor } from '@kbn/aipm-schema-catalog';
import type { AipmFeatureOverview } from '../../common';

interface AipmFeaturePanelProps {
  descriptor: AipmFeatureDescriptor;
  overview?: AipmFeatureOverview;
  buildApmHref: (kuery: string) => string;
}

const themeColors: Record<AipmFeatureDescriptor['showcaseTheme'], string> = {
  investigate: 'primary',
  improve: 'accent',
  operate: 'success',
  govern: 'warning',
  expand: 'hollow',
};

const priorityColors: Record<AipmFeatureDescriptor['showcasePriority'], string> = {
  P0: 'danger',
  P1: 'warning',
  P2: 'hollow',
};

export function AipmFeaturePanel({ descriptor, overview, buildApmHref }: AipmFeaturePanelProps) {
  const apmHref = overview?.apmQuery ? buildApmHref(overview.apmQuery) : undefined;

  return (
    <EuiPanel hasBorder hasShadow={false} paddingSize="l">
      <EuiFlexGroup alignItems="flexStart" justifyContent="spaceBetween" responsive={false}>
        <EuiFlexItem>
          <EuiFlexGroup gutterSize="s" responsive={false} wrap>
            <EuiFlexItem grow={false}>
              <EuiBadge color={priorityColors[descriptor.showcasePriority]}>
                {descriptor.showcasePriority}
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color={themeColors[descriptor.showcaseTheme]}>
                {descriptor.showcaseTheme}
              </EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="s" />
          <EuiTitle size="xs">
            <h3>{descriptor.title}</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            <p>{overview?.summary ?? descriptor.description}</p>
          </EuiText>
        </EuiFlexItem>
        {apmHref ? (
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              href={apmHref}
              iconType="apmTrace"
              size="s"
              data-test-subj="aipmOpenInApmButton"
            >
              Open in APM
            </EuiButtonEmpty>
          </EuiFlexItem>
        ) : null}
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      <EuiFlexGroup gutterSize="s" wrap responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">min tier: {descriptor.minimumSourceTier}</EuiBadge>
        </EuiFlexItem>
        {descriptor.dataRoles.map((role: AipmFeatureDescriptor['dataRoles'][number]) => (
          <EuiFlexItem grow={false} key={role}>
            <EuiBadge color="accent">{role}</EuiBadge>
          </EuiFlexItem>
        ))}
        {descriptor.deliveryAdapters.map(
          (adapter: AipmFeatureDescriptor['deliveryAdapters'][number]) => (
            <EuiFlexItem grow={false} key={adapter}>
              <EuiBadge color="hollow">{adapter}</EuiBadge>
            </EuiFlexItem>
          )
        )}
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      <EuiFlexGrid columns={2} gutterSize="m">
        {(overview?.metrics ?? []).map((metric) => (
          <EuiFlexItem key={`${descriptor.id}-${metric.label}`}>
            <EuiStat
              title={metric.value}
              description={metric.label}
              titleColor={metric.color}
              titleSize="s"
            />
          </EuiFlexItem>
        ))}
      </EuiFlexGrid>

      <EuiHorizontalRule margin="m" />

      <EuiTitle size="xxs">
        <h4>Portable evidence</h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiDescriptionList
        compressed
        listItems={(overview?.sampleRows ?? []).map((row) => ({
          title: row.title,
          description: (
            <>
              {row.subtitle ? (
                <EuiText size="xs" color="subdued">
                  <p>{row.subtitle}</p>
                </EuiText>
              ) : null}
              {row.description ? (
                <EuiText size="xs">
                  <p>{row.description}</p>
                </EuiText>
              ) : null}
              {row.badges?.length ? (
                <>
                  <EuiSpacer size="xs" />
                  <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
                    {Array.from(new Set(row.badges)).map((badge, badgeIndex) => (
                      <EuiFlexItem grow={false} key={`${row.title}-${badge}-${badgeIndex}`}>
                        <EuiBadge color="hollow">{badge}</EuiBadge>
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGroup>
                </>
              ) : null}
            </>
          ),
        }))}
      />
    </EuiPanel>
  );
}
