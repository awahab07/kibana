/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useState } from 'react';
import type { CoreStart } from '@kbn/core/public';
import {
  AIPM_TRACES_API_PATH,
  getAipmTraceDetailApiPath,
  type AipmTraceDetailRouteResponse,
  type AipmTraceListRouteResponse,
} from '../../../common';

export function useAipmTraceData({
  http,
  notifications,
  traceId,
}: {
  http: CoreStart['http'];
  notifications: CoreStart['notifications'];
  traceId?: string;
}) {
  const [list, setList] = useState<AipmTraceListRouteResponse | null>(null);
  const [detail, setDetail] = useState<AipmTraceDetailRouteResponse | null>(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadList = async () => {
      setIsListLoading(true);

      try {
        const response = await http.get<AipmTraceListRouteResponse>(AIPM_TRACES_API_PATH);

        if (isMounted) {
          setList(response);
        }
      } catch (error) {
        if (isMounted) {
          notifications.toasts.addDanger({
            title: 'Unable to load AIPM traces.',
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
        const response = await http.get<AipmTraceDetailRouteResponse>(
          getAipmTraceDetailApiPath(traceId)
        );

        if (isMounted) {
          setDetail(response);
        }
      } catch (error) {
        if (isMounted) {
          setDetail(null);
          notifications.toasts.addDanger({
            title: 'Unable to load the AIPM trace detail.',
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
