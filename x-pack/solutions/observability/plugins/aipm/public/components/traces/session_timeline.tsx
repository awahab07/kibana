/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import type { AipmTraceSessionEvent } from '../../../common';

export function AipmSessionTimeline({ events }: { events: AipmTraceSessionEvent[] }) {
  return (
    <EuiPanel hasBorder hasShadow={false}>
      <EuiTitle size="s">
        <h2>Session timeline</h2>
      </EuiTitle>
      <EuiSpacer size="m" />

      <EuiFlexGroup direction="column" gutterSize="m">
        {events.map((event) => (
          <EuiFlexItem grow={false} key={event.id}>
            <EuiPanel color="subdued" hasBorder paddingSize="m">
              <EuiFlexGroup direction="column" gutterSize="xs">
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    <p>
                      #{event.sequence} • {event.timestamp}
                    </p>
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="s">
                    <strong>{event.message}</strong>
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    <p>
                      {event.action} • {event.level} • {event.outcome}
                    </p>
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                    {event.badges.map((badge) => (
                      <EuiFlexItem grow={false} key={`${event.id}-${badge}`}>
                        <EuiBadge color="hollow">{badge}</EuiBadge>
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGroup>
                </EuiFlexItem>
                {event.summary ? (
                  <EuiFlexItem grow={false}>
                    <EuiText size="s">
                      <p>{event.summary}</p>
                    </EuiText>
                  </EuiFlexItem>
                ) : null}
              </EuiFlexGroup>
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </EuiPanel>
  );
}
