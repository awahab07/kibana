/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import moment from 'moment';
import {
  EuiBasicTable,
  EuiFlexItem,
  EuiFlexGroup,
  EuiSpacer,
  EuiTitle,
  EuiLink,
  EuiText,
  EuiToolTip,
  EuiIcon,
  useEuiTheme,
} from '@elastic/eui';
import { useLegacyUrlParams } from '../../../../context/url_params_context/use_url_params';
import { useFetcher } from '../../../../hooks/use_fetcher';
import { FETCH_STATUS } from '../../../../../../observability/public';
import { useKibanaServices } from '../../../../hooks/use_kibana_services';

export function SessionsList() {
  const { euiTheme } = useEuiTheme();
  const basePath = useKibanaServices().http.basePath;
  const { urlParams, uxUiFilters } = useLegacyUrlParams();

  const { start, end } = urlParams;

  const { data, status } = useFetcher(
    (callApmApi) => {
      if (start && end) {
        return callApmApi('GET /internal/apm/ux/user-sessions', {
          params: {
            query: {
              start,
              end,
              uiFilters: JSON.stringify(uxUiFilters),
            },
          },
        });
      }
      return Promise.resolve(null);
    },
    [start, end, uxUiFilters]
  );

  const cols = [
    {
      field: 'sessionId',
      name: 'Session ID',
      render: (sessionId: string) => <EuiText size="xs">{sessionId}</EuiText>,
    },
    {
      field: 'url',
      name: 'Url',
      render: (url: string) => <EuiText size="xs">{url}</EuiText>,
    },
    {
      field: 'startedAt',
      name: 'Started',
      render: (startedAt: number) => (
        <EuiToolTip content={moment(startedAt).format('YYYY-MM-DD HH:mm:ss')}>
          <EuiText size="s">{moment(startedAt).fromNow()}</EuiText>
        </EuiToolTip>
      ),
    },
    {
      field: 'duration',
      name: 'Duration (m)',
      render: (duration: number) => (
        <EuiText size="s">{(duration / 1000 / 60).toFixed(2)}</EuiText>
      ),
    },
    {
      field: 'isActive',
      name: 'Active',
      render: (isActive: boolean) => (
        <EuiIcon
          type="dot"
          color={isActive ? euiTheme.colors.success : euiTheme.colors.disabled}
        />
      ),
    },
    {
      field: '',
      name: 'Actions',
      render: ({ sessionId }: { sessionId: string }) => (
        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiLink
              href={basePath.prepend(
                `uptime/add-monitor?rumSessionId=${sessionId}`
              )}
              target="_blank"
              external={true}
            >
              Create Synthetics Test
            </EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      ),
    },
  ];

  return (
    <>
      <EuiTitle size="xs">
        <h3>User Sessions</h3>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup>
        <EuiFlexItem grow={false}>
          <EuiBasicTable
            loading={status === FETCH_STATUS.LOADING}
            error={status === FETCH_STATUS.FAILURE ? 'Failed to fetch' : ''}
            responsive={false}
            compressed={true}
            columns={cols}
            items={data?.items ?? []}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
    </>
  );
}
