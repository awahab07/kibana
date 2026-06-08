/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiBadge,
  EuiCallOut,
  EuiCodeBlock,
  EuiDescriptionList,
  EuiFlexGrid,
  EuiFlexItem,
  EuiLink,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import type { AipmTraceSummary } from '../../../common';
import { formatCurrency, formatDurationUs, formatRating } from './formatters';

export function AipmTraceSummaryPanel({
  trace,
  buildApmHref,
}: {
  trace: AipmTraceSummary;
  buildApmHref: (apmQuery: string) => string;
}) {
  return (
    <EuiFlexGrid columns={2} gutterSize="l">
      <EuiFlexItem>
        <EuiPanel hasBorder hasShadow={false}>
          <EuiTitle size="s">
            <h2>{trace.workflowName}</h2>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiDescriptionList
            compressed
            listItems={[
              {
                title: 'Service',
                description: trace.serviceName,
              },
              {
                title: 'Provider',
                description: trace.provider ?? 'n/a',
              },
              {
                title: 'Model',
                description: trace.model ?? 'n/a',
              },
              {
                title: 'Latency',
                description: formatDurationUs(trace.durationUs),
              },
              {
                title: 'Total cost',
                description: formatCurrency(trace.totalCost),
              },
              {
                title: 'User rating',
                description: formatRating(trace.userRating),
              },
              {
                title: 'LLM judge',
                description:
                  trace.evaluationScore !== undefined
                    ? `${trace.evaluationScore.toFixed(2)} (${trace.evaluationLabel ?? 'score'})`
                    : 'n/a',
              },
            ]}
          />
          <EuiSpacer size="m" />
          <EuiText size="s">
            <p>
              <strong>Tokens:</strong> {trace.inputTokens} input / {trace.outputTokens} output
            </p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiLink
            href={buildApmHref(trace.apmQuery)}
            data-test-subj="aipmTraceSummaryOpenInApmLink"
          >
            Open this trace in APM
          </EuiLink>
        </EuiPanel>
      </EuiFlexItem>

      <EuiFlexItem>
        <EuiPanel hasBorder hasShadow={false}>
          <EuiTitle size="xs">
            <h3>Execution badges</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFlexGrid columns={2} gutterSize="s">
            {trace.badges.map((badge) => (
              <EuiFlexItem key={`${trace.traceId}-${badge}`}>
                <EuiBadge color="hollow">{badge}</EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGrid>
          {trace.warning ? (
            <>
              <EuiSpacer size="m" />
              <EuiCallOut title="Execution warning" color="warning" iconType="warning" size="s">
                <p>{trace.warning}</p>
              </EuiCallOut>
            </>
          ) : null}
        </EuiPanel>
      </EuiFlexItem>

      <EuiFlexItem>
        <EuiPanel hasBorder hasShadow={false}>
          <EuiTitle size="xs">
            <h3>User prompt</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiCodeBlock language="text" isCopyable fontSize="s" paddingSize="m">
            {trace.promptText ?? 'Prompt unavailable'}
          </EuiCodeBlock>
        </EuiPanel>
      </EuiFlexItem>

      <EuiFlexItem>
        <EuiPanel hasBorder hasShadow={false}>
          <EuiTitle size="xs">
            <h3>Assistant response</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiCodeBlock language="text" isCopyable fontSize="s" paddingSize="m">
            {trace.answerText ?? 'Response unavailable'}
          </EuiCodeBlock>
        </EuiPanel>
      </EuiFlexItem>
    </EuiFlexGrid>
  );
}
