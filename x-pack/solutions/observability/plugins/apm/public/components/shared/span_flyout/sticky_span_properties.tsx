/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import React from 'react';
import { EuiLink } from '@elastic/eui';
import { METRIC_TYPE, useUiTracker } from '@kbn/observability-shared-plugin/public';
import { useApmRouter } from '../../../hooks/use_apm_router';
import { useApmPluginContext } from '../../../context/apm_plugin/use_apm_plugin_context';
import {
  SERVICE_NAME,
  SPAN_DESTINATION_SERVICE_RESOURCE,
  SPAN_NAME,
  TRANSACTION_NAME,
} from '../../../../common/es_fields/apm';
import {
  ENVIRONMENT_NOT_DEFINED,
  getNextEnvironmentUrlParam,
} from '../../../../common/environment_filter_values';
import { NOT_AVAILABLE_LABEL } from '../../../../common/i18n';
import type { Span } from '../../../../typings/es_schemas/ui/span';
import type { Transaction } from '../../../../typings/es_schemas/ui/transaction';
import { useAnyOfApmParams } from '../../../hooks/use_apm_params';
import { DependencyLink } from '../links/dependency_link';
import { TransactionDetailLink } from '../links/apm/transaction_detail_link';
import { ServiceLink } from '../links/apm/service_link';
import { StickyProperties } from '../sticky_properties';
import { LatencyAggregationType } from '../../../../common/latency_aggregation_types';

interface Props {
  span: Span;
  transaction?: Transaction;
}

function readFirstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
}

function getAipmMapStepId(span: Span) {
  const attributes = span.attributes as
    | {
        es_sdk?: {
          map?: {
            step_id?: unknown;
          };
        };
      }
    | undefined;

  return readFirstString(attributes?.es_sdk?.map?.step_id);
}

export function StickySpanProperties({ span, transaction }: Props) {
  const { query } = useAnyOfApmParams(
    '/services/{serviceName}/transactions/view',
    '/mobile-services/{serviceName}/transactions/view',
    '/dependencies/operation'
  );
  const router = useApmRouter();
  const { core } = useApmPluginContext();

  const { environment } = query;

  const latencyAggregationType =
    ('latencyAggregationType' in query && query.latencyAggregationType) ||
    LatencyAggregationType.avg;

  const serviceGroup = ('serviceGroup' in query && query.serviceGroup) || '';

  const trackEvent = useUiTracker();

  const nextEnvironment = getNextEnvironmentUrlParam({
    requestedEnvironment: transaction?.service?.environment ?? ENVIRONMENT_NOT_DEFINED.value,
    currentEnvironmentUrlParam: environment,
  });

  const spanName = span.span?.name;
  const dependencyName = span.span?.destination?.service.resource;
  const traceId = span.trace?.id;
  const aipmMapStepId = getAipmMapStepId(span);

  const transactionServiceName = transaction?.service?.name;
  const transactionAgentName = transaction?.agent?.name;
  const transactionName = transaction?.transaction?.name;

  const transactionStickyProperties = transaction
    ? [
        {
          label: i18n.translate('xpack.apm.transactionDetails.serviceLabel', {
            defaultMessage: 'Service',
          }),
          fieldName: SERVICE_NAME,
          val: transactionServiceName ? (
            <ServiceLink
              agentName={transactionAgentName}
              query={{
                ...query,
                serviceGroup,
                environment: nextEnvironment,
              }}
              serviceName={transactionServiceName}
            />
          ) : (
            NOT_AVAILABLE_LABEL
          ),
          width: '25%',
        },
        {
          label: i18n.translate('xpack.apm.transactionDetails.transactionLabel', {
            defaultMessage: 'Transaction',
          }),
          fieldName: TRANSACTION_NAME,
          val:
            transactionName && transactionServiceName ? (
              <TransactionDetailLink
                transactionName={transactionName}
                href={router.link('/services/{serviceName}/transactions/view', {
                  path: { serviceName: transactionServiceName },
                  query: {
                    ...query,
                    environment: nextEnvironment,
                    serviceGroup,
                    latencyAggregationType,
                    transactionName,
                  },
                })}
              >
                {transactionName}
              </TransactionDetailLink>
            ) : (
              transactionName ?? NOT_AVAILABLE_LABEL
            ),
          width: '25%',
        },
      ]
    : [];

  const dependencyStickyProperties = dependencyName
    ? [
        {
          label: i18n.translate('xpack.apm.transactionDetails.spanFlyout.dependencyLabel', {
            defaultMessage: 'Dependency',
          }),
          fieldName: SPAN_DESTINATION_SERVICE_RESOURCE,
          val: (
            <DependencyLink
              query={{
                ...query,
                dependencyName,
              }}
              subtype={span.span?.subtype}
              type={span.span?.type}
              onClick={() => {
                trackEvent({
                  app: 'apm',
                  metricType: METRIC_TYPE.CLICK,
                  metric: 'span_flyout_to_dependency_detail',
                });
              }}
            />
          ),
          width: '25%',
        },
      ]
    : [];

  const agentTransactionStickyProperties =
    traceId && aipmMapStepId
      ? [
          {
            label: i18n.translate('xpack.apm.transactionDetails.spanFlyout.agentTransactionLabel', {
              defaultMessage: 'Agent transaction',
            }),
            fieldName: 'attributes.es_sdk.map.step_id',
            val: (
              <EuiLink
                data-test-subj="apmSpanFlyoutOpenAgentMapLink"
                href={core.http.basePath.prepend(
                  `/app/aipm/agent-map/${encodeURIComponent(
                    traceId
                  )}?focusNodeId=${encodeURIComponent(aipmMapStepId)}`
                )}
              >
                {aipmMapStepId}
              </EuiLink>
            ),
            width: '25%',
          },
        ]
      : [];

  const stickyProperties = [
    {
      label: i18n.translate('xpack.apm.transactionDetails.spanFlyout.nameLabel', {
        defaultMessage: 'Name',
      }),
      fieldName: SPAN_NAME,
      val: spanName ?? NOT_AVAILABLE_LABEL,
      truncated: true,
      width: '25%',
    },
    ...dependencyStickyProperties,
    ...agentTransactionStickyProperties,
    ...transactionStickyProperties,
  ];

  return <StickyProperties stickyProperties={stickyProperties} />;
}
