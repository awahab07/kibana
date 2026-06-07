/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiEmptyPrompt,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPanel,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import type { AipmCuratedTraceListItem } from '../../../common';
import { formatCurrency, formatDurationUs, formatRating, previewText } from './formatters';

export function AipmTraceSelectorPanel({
  traces,
  selectedTraceId,
  isLoading,
  onSelectTrace,
}: {
  traces: AipmCuratedTraceListItem[];
  selectedTraceId?: string;
  isLoading: boolean;
  onSelectTrace: (traceId: string) => void;
}) {
  const { euiTheme } = useEuiTheme();

  const interactiveStyles = css`
    cursor: pointer;

    &:focus-visible {
      outline: ${euiTheme.border.width.thick} solid ${euiTheme.colors.primary};
      outline-offset: ${euiTheme.size.xxs};
    }
  `;

  return (
    <EuiPanel hasBorder hasShadow={false} paddingSize="m">
      <EuiFlexGroup direction="column" gutterSize="m">
        <EuiFlexItem grow={false}>
          <EuiTitle size="s">
            <h2>Curated traces</h2>
          </EuiTitle>
        </EuiFlexItem>

        {isLoading ? (
          <EuiFlexItem grow={false}>
            <EuiLoadingSpinner size="m" />
          </EuiFlexItem>
        ) : traces.length === 0 ? (
          <EuiFlexItem grow={false}>
            <EuiEmptyPrompt
              iconType="inspect"
              title={<h3>No curated traces yet</h3>}
              body={
                <p>Run the curated full-stack journey synthtrace scenario to populate this view.</p>
              }
            />
          </EuiFlexItem>
        ) : (
          traces.map((trace) => {
            const isSelected = trace.traceId === selectedTraceId;

            return (
              <EuiFlexItem grow={false} key={trace.traceId}>
                <div
                  css={interactiveStyles}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTrace(trace.traceId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectTrace(trace.traceId);
                    }
                  }}
                  data-test-subj={`aipmTraceSelector-${trace.traceId}`}
                >
                  <EuiPanel
                    hasBorder
                    hasShadow={false}
                    color={isSelected ? 'primary' : 'subdued'}
                    paddingSize="m"
                  >
                    <EuiFlexGroup direction="column" gutterSize="xs">
                      <EuiFlexItem grow={false}>
                        <EuiText size="s">
                          <strong>{trace.workflowName}</strong>
                        </EuiText>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText size="xs" color="subdued">
                          <p>{trace.serviceName}</p>
                        </EuiText>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText size="xs">
                          <p>
                            {formatDurationUs(trace.durationUs)} • {formatCurrency(trace.totalCost)}{' '}
                            • {formatRating(trace.userRating)}
                          </p>
                        </EuiText>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                          {trace.badges.map((badge) => (
                            <EuiFlexItem grow={false} key={`${trace.traceId}-${badge}`}>
                              <EuiBadge color="hollow">{badge}</EuiBadge>
                            </EuiFlexItem>
                          ))}
                        </EuiFlexGroup>
                      </EuiFlexItem>
                      {trace.answerPreview ? (
                        <EuiFlexItem grow={false}>
                          <EuiText size="xs" color="subdued">
                            <p>{previewText(trace.answerPreview, 100)}</p>
                          </EuiText>
                        </EuiFlexItem>
                      ) : null}
                    </EuiFlexGroup>
                  </EuiPanel>
                </div>
              </EuiFlexItem>
            );
          })
        )}
      </EuiFlexGroup>
    </EuiPanel>
  );
}
