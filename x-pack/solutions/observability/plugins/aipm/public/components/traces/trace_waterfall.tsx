/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo, useState } from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import type { AipmTraceWaterfallItem } from '../../../common';
import { formatCurrency, formatDurationUs, getNodeKindColor, getNodeKindLabel } from './formatters';

export function AipmTraceWaterfall({ items }: { items: AipmTraceWaterfallItem[] }) {
  const { euiTheme } = useEuiTheme();
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(items[0]?.id);

  const totalDurationUs = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.offsetUs + item.durationUs), 0) || 1,
    [items]
  );

  const trackStyles = css`
    position: relative;
    height: 20px;
    border-radius: ${euiTheme.border.radius.medium};
    background: ${euiTheme.colors.lightestShade};
    overflow: hidden;
  `;

  const clickableStyles = css`
    cursor: pointer;

    &:focus-visible {
      outline: ${euiTheme.border.width.thick} solid ${euiTheme.colors.primary};
      outline-offset: ${euiTheme.size.xxs};
    }
  `;

  const selectedItem = items.find((item) => item.id === selectedItemId);

  return (
    <EuiPanel hasBorder hasShadow={false}>
      <EuiTitle size="s">
        <h2>Trace waterfall</h2>
      </EuiTitle>
      <EuiSpacer size="m" />

      <EuiFlexGroup direction="column" gutterSize="s">
        {items.map((item) => {
          const color = getNodeKindColor(item.nodeKind, item.outcome);
          const left = `${(item.offsetUs / totalDurationUs) * 100}%`;
          const width = `${Math.max(4, (item.durationUs / totalDurationUs) * 100)}%`;
          const isSelected = item.id === selectedItemId;

          const barStyles = css`
            position: absolute;
            top: 0;
            left: ${left};
            width: ${width};
            height: 100%;
            border-radius: ${euiTheme.border.radius.medium};
            background: ${color === 'danger'
              ? euiTheme.colors.danger
              : color === 'warning'
              ? euiTheme.colors.warning
              : color === 'success'
              ? euiTheme.colors.success
              : color === 'accent'
              ? euiTheme.colors.accent
              : euiTheme.colors.primary};
            opacity: 0.85;
          `;

          return (
            <EuiFlexItem grow={false} key={item.id}>
              <div
                css={clickableStyles}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedItemId(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedItemId(item.id);
                  }
                }}
                data-test-subj={`aipmWaterfallItem-${item.id}`}
              >
                <EuiPanel
                  hasBorder
                  hasShadow={false}
                  color={isSelected ? 'primary' : 'transparent'}
                  paddingSize="s"
                >
                  <EuiFlexGroup alignItems="center" gutterSize="m">
                    <EuiFlexItem grow={3}>
                      <div style={{ paddingLeft: item.depth * 18 }}>
                        <EuiText size="s">
                          <strong>{item.label}</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          <p>
                            {item.serviceName} • {getNodeKindLabel(item.nodeKind)}
                          </p>
                        </EuiText>
                      </div>
                    </EuiFlexItem>
                    <EuiFlexItem grow={4}>
                      <div css={trackStyles}>
                        <div css={barStyles} />
                      </div>
                    </EuiFlexItem>
                    <EuiFlexItem grow={2}>
                      <EuiText size="xs">
                        <p>
                          {formatDurationUs(item.durationUs)}
                          {item.cost ? ` • ${formatCurrency(item.cost)}` : ''}
                        </p>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </div>
            </EuiFlexItem>
          );
        })}
      </EuiFlexGroup>

      {selectedItem ? (
        <>
          <EuiSpacer size="l" />
          <EuiPanel color="subdued" hasBorder>
            <EuiFlexGroup direction="column" gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  <strong>{selectedItem.label}</strong>
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color={getNodeKindColor(selectedItem.nodeKind, selectedItem.outcome)}>
                      {getNodeKindLabel(selectedItem.nodeKind)}
                    </EuiBadge>
                  </EuiFlexItem>
                  {selectedItem.badges.map((badge) => (
                    <EuiFlexItem grow={false} key={`${selectedItem.id}-${badge}`}>
                      <EuiBadge color="hollow">{badge}</EuiBadge>
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </EuiFlexItem>
              {selectedItem.summary ? (
                <EuiFlexItem grow={false}>
                  <EuiText size="s">
                    <p>{selectedItem.summary}</p>
                  </EuiText>
                </EuiFlexItem>
              ) : null}
              {selectedItem.warning ? (
                <EuiFlexItem grow={false}>
                  <EuiText color="warning" size="s">
                    <p>{selectedItem.warning}</p>
                  </EuiText>
                </EuiFlexItem>
              ) : null}
              {selectedItem.inputText ? (
                <EuiFlexItem grow={false}>
                  <EuiTitle size="xxs">
                    <h3>Input</h3>
                  </EuiTitle>
                  <EuiSpacer size="s" />
                  <EuiCodeBlock language="text" fontSize="s" paddingSize="m">
                    {selectedItem.inputText}
                  </EuiCodeBlock>
                </EuiFlexItem>
              ) : null}
              {selectedItem.outputText ? (
                <EuiFlexItem grow={false}>
                  <EuiTitle size="xxs">
                    <h3>Output</h3>
                  </EuiTitle>
                  <EuiSpacer size="s" />
                  <EuiCodeBlock language="text" fontSize="s" paddingSize="m">
                    {selectedItem.outputText}
                  </EuiCodeBlock>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
          </EuiPanel>
        </>
      ) : null}
    </EuiPanel>
  );
}
