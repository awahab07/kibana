/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiBasicTable,
  EuiFlexItem,
  EuiFlexGroup,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';
import { useLegacyUrlParams } from '../../../../context/url_params_context/use_url_params';
import { useFetcher } from '../../../../hooks/use_fetcher';
import { FETCH_STATUS } from '../../../../../../observability/public';

export function SessionsList() {
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
    },
    {
      field: 'startedAt',
      name: 'Started',
    },
    {
      field: 'duration',
      name: 'Duration',
    },
    {
      field: 'isActive',
      name: 'Active',
    },
    {
      field: '',
      name: 'Actions',
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
