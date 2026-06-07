/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useState } from 'react';
import type { CoreStart } from '@kbn/core/public';
import {
  AIPM_CURATED_TRACES_API_PATH,
  getAipmCuratedTraceDetailApiPath,
  type AipmCuratedTraceDetailRouteResponse,
  type AipmCuratedTraceListRouteResponse,
} from '../../../common';

export function useCuratedTraceData({
  http,
  notifications,
  traceId,
}: {
  http: CoreStart['http'];
  notifications: CoreStart['notifications'];
  traceId?: string;
}) {
  const [list, setList] = useState<AipmCuratedTraceListRouteResponse | null>(null);
  const [detail, setDetail] = useState<AipmCuratedTraceDetailRouteResponse | null>(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadList = async () => {
      setIsListLoading(true);

      try {
        const response = await http.get<AipmCuratedTraceListRouteResponse>(
          AIPM_CURATED_TRACES_API_PATH
        );

        if (isMounted) {
          setList(response);
        }
      } catch (error) {
        if (isMounted) {
          notifications.toasts.addDanger({
            title: 'Unable to load curated AIPM traces.',
          });
        }
      } finally {
        if (isMounted) {
          setIsListLoading(false);
        }
      }
    };

    void loadList();

    return () => {
      isMounted = false;
    };
  }, [http, notifications]);

  useEffect(() => {
    let isMounted = true;

    if (!traceId) {
      setDetail(null);
      setIsDetailLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const loadDetail = async () => {
      setIsDetailLoading(true);

      try {
        const response = await http.get<AipmCuratedTraceDetailRouteResponse>(
          getAipmCuratedTraceDetailApiPath(traceId)
        );

        if (isMounted) {
          setDetail(response);
        }
      } catch (error) {
        if (isMounted) {
          setDetail(null);
          notifications.toasts.addDanger({
            title: 'Unable to load the curated AIPM trace detail.',
          });
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [http, notifications, traceId]);

  return {
    list,
    detail,
    isListLoading,
    isDetailLoading,
  };
}
