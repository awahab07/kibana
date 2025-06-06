/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useRef, useCallback } from 'react';

import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import type { MappingRuntimeFields } from '@elastic/elasticsearch/lib/api/types';

import type { FieldValidationResults } from '@kbn/ml-category-validator';
import type { HttpFetchOptions } from '@kbn/core/public';
import { AIOPS_API_ENDPOINT } from '@kbn/aiops-common/constants';

import { createDefaultQuery } from '@kbn/aiops-common/create_default_query';

import { useAiopsAppContext } from '../../hooks/use_aiops_app_context';

export function useValidateFieldRequest() {
  const { http } = useAiopsAppContext();
  const abortController = useRef(new AbortController());

  const runValidateFieldRequest = useCallback(
    async (
      index: string,
      field: string,
      timeField: string,
      timeRange: { from: number; to: number },
      queryIn: QueryDslQueryContainer,
      runtimeMappings: MappingRuntimeFields | undefined,
      headers?: HttpFetchOptions['headers']
    ) => {
      const query = createDefaultQuery(queryIn, timeField, timeRange);
      const resp = await http.post<FieldValidationResults>(
        AIOPS_API_ENDPOINT.CATEGORIZATION_FIELD_VALIDATION,
        {
          body: JSON.stringify({
            indexPatternTitle: index,
            query,
            size: 5,
            field,
            timeField,
            start: timeRange.from,
            end: timeRange.to,
            runtimeMappings,
            indicesOptions: undefined,
            includeExamples: false,
          }),
          headers,
          version: '1',
          signal: abortController.current.signal,
        }
      );

      return resp;
    },
    [http]
  );

  const cancelRequest = useCallback(() => {
    abortController.current.abort();
    abortController.current = new AbortController();
  }, []);

  return { runValidateFieldRequest, cancelRequest };
}
