/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { InventoryItemType, InventoryTsvbType } from '@kbn/metrics-data-access-plugin/common';
import type { BehaviorSubject } from 'rxjs';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import { isPending, useFetcher } from '../../../hooks/use_fetcher';
import { InfraMetadataRT } from '../../../../common/http_api/metadata_api';
import { getFilteredMetrics } from '../../../pages/metrics/metric_detail/lib/get_filtered_metrics';

interface UseMetadataProps {
  entityId: string;
  entityType: InventoryItemType;
  requiredTsvb?: InventoryTsvbType[];
  sourceId: string;
  timeRange: {
    from: number;
    to: number;
  };
  request$?: BehaviorSubject<(() => Promise<unknown>) | undefined>;
}
export function useMetadata({
  entityId,
  entityType,
  sourceId,
  timeRange,
  requiredTsvb = [],
  request$,
}: UseMetadataProps) {
  const { data, status, error, refetch } = useFetcher(
    async (callApi) => {
      const response = await callApi('/api/infra/metadata', {
        method: 'POST',
        body: JSON.stringify({
          nodeId: entityId,
          nodeType: entityType,
          sourceId,
          timeRange,
        }),
      });
      return decodeOrThrow(InfraMetadataRT)(response);
    },
    [entityId, entityType, sourceId, timeRange],
    {
      requestObservable$: request$,
    }
  );

  return {
    name: (data && data.name) || '',
    filteredRequiredMetrics:
      data && requiredTsvb.length > 0 ? getFilteredMetrics(requiredTsvb, data.features) : [],
    error: (error && error.message) || null,
    loading: isPending(status),
    metadata: data,
    cloudId: data?.info?.cloud?.instance?.id || '',
    reload: refetch,
  };
}
