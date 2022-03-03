/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  TermsEnumRequest,
  TermsEnumResponse,
} from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { ValuesType } from 'utility-types';
import { withApmSpan } from '../../../../utils/with_apm_span';
import { Profile } from '../../../../../typings/es_schemas/ui/profile';
import {
  ElasticsearchClient,
  KibanaRequest,
} from '../../../../../../../../src/core/server';
import {
  ESSearchRequest,
  InferSearchResponseOf,
} from '../../../../../../../../src/core/types/elasticsearch';
import { unwrapEsResponse } from '../../../../../../observability/server';
import { ProcessorEvent } from '../../../../../common/processor_event';
import { APMError } from '../../../../../typings/es_schemas/ui/apm_error';
import { Metric } from '../../../../../typings/es_schemas/ui/metric';
import { Span } from '../../../../../typings/es_schemas/ui/span';
import { Transaction } from '../../../../../typings/es_schemas/ui/transaction';
import { ApmIndicesConfig } from '../../../../routes/settings/apm_indices/get_apm_indices';
import {
  callAsyncWithDebug,
  getDebugBody,
  getDebugTitle,
} from '../call_async_with_debug';
import { cancelEsRequestOnAbort } from '../cancel_es_request_on_abort';
import { unpackProcessorEvents } from './unpack_processor_events';

export type APMEventESSearchRequest = Omit<ESSearchRequest, 'index'> & {
  apm: {
    events: ProcessorEvent[];
    includeLegacyData?: boolean;
  };
};

export type APMEventESTermsEnumRequest = Omit<TermsEnumRequest, 'index'> & {
  apm: { events: ProcessorEvent[] };
};

// These keys shoul all be `ProcessorEvent.x`, but until TypeScript 4.2 we're inlining them here.
// See https://github.com/microsoft/TypeScript/issues/37888
type TypeOfProcessorEvent<T extends ProcessorEvent> = {
  error: APMError;
  transaction: Transaction;
  span: Span;
  metric: Metric;
  profile: Profile;
}[T];

type TypedSearchResponse<TParams extends APMEventESSearchRequest> =
  InferSearchResponseOf<
    TypeOfProcessorEvent<ValuesType<TParams['apm']['events']>>,
    TParams
  >;

export interface APMEventClientConfig {
  esClient: ElasticsearchClient;
  debug: boolean;
  request: KibanaRequest;
  indices: ApmIndicesConfig;
  options: {
    includeFrozen: boolean;
  };
}

export class APMEventClient {
  private readonly esClient: ElasticsearchClient;
  private readonly debug: boolean;
  private readonly request: KibanaRequest;
  private readonly indices: ApmIndicesConfig;
  private readonly includeFrozen: boolean;

  constructor(config: APMEventClientConfig) {
    this.esClient = config.esClient;
    this.debug = config.debug;
    this.request = config.request;
    this.indices = config.indices;
    this.includeFrozen = config.options.includeFrozen;
  }

  async search<TParams extends APMEventESSearchRequest>(
    operationName: string,
    params: TParams
  ): Promise<TypedSearchResponse<TParams>> {
    const withProcessorEventFilter = unpackProcessorEvents(
      params,
      this.indices
    );

    const searchParams = {
      ...withProcessorEventFilter,
      ...(this.includeFrozen ? { ignore_throttled: false } : {}),
      ignore_unavailable: true,
      preference: 'any',
    };

    // only "search" operation is currently supported
    const requestType = 'search';

    return callAsyncWithDebug({
      cb: () => {
        const searchPromise = withApmSpan(operationName, () => {
          const controller = new AbortController();
          return cancelEsRequestOnAbort(
            this.esClient.search(searchParams, {
              signal: controller.signal,
              meta: true,
            }),
            this.request,
            controller
          );
        });

        return unwrapEsResponse(searchPromise);
      },
      getDebugMessage: () => ({
        body: getDebugBody({
          params: searchParams,
          requestType,
          operationName,
        }),
        title: getDebugTitle(this.request),
      }),
      isCalledWithInternalUser: false,
      debug: this.debug,
      request: this.request,
      requestType,
      operationName,
      requestParams: searchParams,
    });
  }

  async getUserSessions(start: number, end: number): Promise<any> {
    // TODO: Use a raw es query here using this.esClient and on the synthplay index to get
    // all the user sessions within range 'start' and 'end'

    const { aggregations, hits } = await this.esClient.search<any>({
      index: 'synthplay_test',
      size: 10000,
      body: {
        aggs: {
          sessions: {
            terms: {
              field: 'enriched.sessionId.keyword',
              size: 10,
              order: {
                latestOrder: 'desc',
              },
            },
            aggs: {
              latestOrder: {
                max: {
                  field: 'timestamp',
                },
              },
            },
          },
        },
      },
    });

    const sessionIds = ((aggregations?.sessions as any)?.buckets ?? []).map(
      ({ key }: { key: string }) => key
    );

    const sessionRecordsMap = sessionIds.reduce(
      (acc: Map<string, object>, cur: string) => {
        const sessionHits = hits.hits
          .filter(({ _source }: any) => _source.enriched.sessionId === cur)
          .map(({ _source }: any) => _source);

        sessionHits.sort((a: any, b: any) => a.timestamp - b.timestamp);

        acc.set(cur, sessionHits);
        return acc;
      },
      new Map()
    );

    return Promise.resolve(
      sessionIds.map((sessionId: string) => {
        const sessionRecords = sessionRecordsMap.get(sessionId) ?? [];
        const nHits = sessionRecords.length;
        const startedAt = sessionRecords?.[0]?.timestamp ?? 0;
        const endedAt = sessionRecords?.[nHits - 1]?.timestamp ?? 0;
        const isActive = new Date().getTime() - endedAt < 2 * 1000 * 60;
        const url = sessionRecords?.[0]?.data?.href ?? '';

        return {
          sessionId,
          url,
          startedAt,
          duration: endedAt - startedAt,
          isActive,
        };
      })
    );
  }

  async termsEnum(
    operationName: string,
    params: APMEventESTermsEnumRequest
  ): Promise<TermsEnumResponse> {
    const requestType = 'terms_enum';
    const { index } = unpackProcessorEvents(params, this.indices);

    return callAsyncWithDebug({
      cb: () => {
        const { apm, ...rest } = params;
        const termsEnumPromise = withApmSpan(operationName, () => {
          const controller = new AbortController();
          return cancelEsRequestOnAbort(
            this.esClient.termsEnum(
              {
                index: Array.isArray(index) ? index.join(',') : index,
                ...rest,
              },
              { signal: controller.signal, meta: true }
            ),
            this.request,
            controller
          );
        });

        return unwrapEsResponse(termsEnumPromise);
      },
      getDebugMessage: () => ({
        body: getDebugBody({
          params,
          requestType,
          operationName,
        }),
        title: getDebugTitle(this.request),
      }),
      isCalledWithInternalUser: false,
      debug: this.debug,
      request: this.request,
      requestType,
      operationName,
      requestParams: params,
    });
  }
}
