/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { css } from '@emotion/react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiText,
  useEuiTheme,
} from '@elastic/eui';
import type { AipmTraceMapNode } from '../../../common';
import { formatCurrency, formatDurationUs, getNodeKindColor, getNodeKindLabel } from './formatters';

export type AipmMapNodeData = AipmTraceMapNode & Record<string, unknown>;
export type AipmAgentMapNodeType = Node<AipmMapNodeData, 'aipmNode'>;

function getNodeIcon(nodeKind: string) {
  switch (nodeKind) {
    case 'prompt':
      return 'editorComment';
    case 'agent':
      return 'machineLearningApp';
    case 'guardrail':
      return 'shield';
    case 'model':
      return 'sparkles';
    case 'retriever':
      return 'search';
    case 'tool':
      return 'wrench';
    case 'mcp':
      return 'merge';
    case 'service':
      return 'storage';
    case 'evaluator':
      return 'visGauge';
    case 'feedback':
      return 'faceHappy';
    case 'response':
      return 'check';
    default:
      return 'node';
  }
}

export function AipmAgentMapNode({ data }: NodeProps<AipmAgentMapNodeType>) {
  const { euiTheme } = useEuiTheme();
  const accentColor = getNodeKindColor(data.nodeKind, data.outcome);

  const panelStyles = css`
    width: 240px;
    border-top: ${euiTheme.border.width.thick} solid
      ${accentColor === 'danger'
        ? euiTheme.colors.danger
        : accentColor === 'warning'
        ? euiTheme.colors.warning
        : accentColor === 'success'
        ? euiTheme.colors.success
        : accentColor === 'accent'
        ? euiTheme.colors.accent
        : euiTheme.colors.primary};
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
  `;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <EuiPanel hasBorder paddingSize="m" css={panelStyles}>
        <EuiFlexGroup direction="column" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiIcon type={getNodeIcon(data.nodeKind)} />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiText size="s">
                  <strong>{data.label}</strong>
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">
              <p>{data.subtitle ?? getNodeKindLabel(data.nodeKind)}</p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiBadge color={accentColor}>{getNodeKindLabel(data.nodeKind)}</EuiBadge>
              </EuiFlexItem>
              {data.badges.slice(0, 2).map((badge) => (
                <EuiFlexItem grow={false} key={`${data.id}-${badge}`}>
                  <EuiBadge color="hollow">{badge}</EuiBadge>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="xs">
              <p>
                {formatDurationUs(data.durationUs)}
                {data.cost ? ` • ${formatCurrency(data.cost)}` : ''}
              </p>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </>
  );
}
