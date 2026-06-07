/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ApmOtelFields, LogDocument } from '@kbn/synthtrace-client';
import { ApmSynthtracePipelineSchema } from '@kbn/synthtrace-client';
import { getSynthtraceEnvironment, type Scenario, withClient } from '@kbn/synthtrace';
import {
  buildInternalSpan,
  buildModelCallSpan,
  buildSessionLogs,
  buildWorkflowRoot,
  createStoryIdentifiers,
  createStoryServices,
  getIncidentWindow,
  inIncidentWindow,
  storyTraceLabel,
} from './helpers/aipm_story_helpers';

const ENVIRONMENT = getSynthtraceEnvironment(__filename);
const STORY_ID = 'aipm-provider-runtime-schema-drift';

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);
      const { incidentStart, incidentEnd } = getIncidentWindow(range, 0.52, 0.86);
      const variants = [
        'bedrock-throttled',
        'truncated-response',
        'old-semconv-fields',
        'missing-eval-events',
        'collector-drop',
      ];

      const traceEvents = range
        .interval('80s')
        .rate(10)
        .generator((timestamp, index) => {
          const incidentVariant = variants[index % variants.length];
          const variantId = inIncidentWindow(timestamp, incidentStart, incidentEnd)
            ? incidentVariant
            : 'healthy-provider';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);

          const telemetrySpan = buildInternalSpan({
            instance: services.guardrail,
            name: 'telemetry.integrity.check',
            timestamp: timestamp + 20,
            duration: 75,
            outcome: variantId === 'collector-drop' ? 'failure' : 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_integ.telemetry.drop_detected': variantId === 'collector-drop',
              'attributes.es_integ.schema.old_semconv_fields': variantId === 'old-semconv-fields',
            },
          });

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 110,
            duration:
              variantId === 'bedrock-throttled'
                ? 2400
                : variantId === 'truncated-response'
                ? 1280
                : 920,
            outcome:
              variantId === 'healthy-provider' || variantId === 'old-semconv-fields'
                ? 'success'
                : 'failure',
            provider: variantId === 'bedrock-throttled' ? 'bedrock' : 'anthropic',
            model: variantId === 'bedrock-throttled' ? 'claude-3-5-sonnet' : 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: 1700,
            cachedInputTokens: 150,
            outputTokens: variantId === 'truncated-response' ? 90 : 520,
            cost: variantId === 'bedrock-throttled' ? 0.081 : 0.047,
            promptText: 'Explain the runtime regression and summarize affected users.',
            outputText:
              variantId === 'truncated-response'
                ? 'The response stopped mid sentence'
                : 'The provider call completed successfully.',
            extraFields: {
              'attributes.es_integ.provider.error_type':
                variantId === 'bedrock-throttled'
                  ? 'throttling_exception'
                  : variantId === 'truncated-response'
                  ? 'truncated_stream'
                  : undefined,
              'attributes.llm.model':
                variantId === 'old-semconv-fields' ? 'legacy-model-field' : undefined,
              'attributes.es_integ.telemetry.expect_eval': variantId !== 'missing-eval-events',
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration:
              variantId === 'bedrock-throttled'
                ? 2620
                : variantId === 'truncated-response'
                ? 1510
                : variantId === 'collector-drop'
                ? 1180
                : 1090,
            outcome:
              variantId === 'healthy-provider' || variantId === 'old-semconv-fields'
                ? 'success'
                : 'failure',
            workflowName: 'provider.runtime.diagnostics',
            provider: variantId === 'bedrock-throttled' ? 'bedrock' : 'anthropic',
            model: variantId === 'bedrock-throttled' ? 'claude-3-5-sonnet' : 'claude-3-7-sonnet',
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variantId),
            inputTokens: 1700,
            cachedInputTokens: 150,
            outputTokens: variantId === 'truncated-response' ? 90 : 520,
            cost: variantId === 'bedrock-throttled' ? 0.081 : 0.047,
            promptText: 'Explain the runtime regression and summarize affected users.',
            outputText:
              variantId === 'truncated-response'
                ? 'The response stopped mid sentence'
                : 'The provider call completed successfully.',
            extraFields: {
              'attributes.es_integ.schema.old_semconv_fields': variantId === 'old-semconv-fields',
              'attributes.es_integ.telemetry.drop_detected': variantId === 'collector-drop',
            },
          }).children(telemetrySpan, modelCall);

          if (variantId !== 'missing-eval-events') {
            root.children(
              buildInternalSpan({
                instance: services.evaluator,
                name: 'evaluation.runtime_postcheck',
                timestamp: timestamp + 920,
                duration: 85,
                outcome:
                  variantId === 'healthy-provider' || variantId === 'old-semconv-fields'
                    ? 'success'
                    : 'failure',
                extraFields: {
                  'attributes.es_sdk.evaluation.label':
                    variantId === 'healthy-provider' || variantId === 'old-semconv-fields'
                      ? 'runtime_ok'
                      : 'runtime_regressed',
                },
              })
            );
          }

          return root;
        });

      const logEvents = range
        .interval('80s')
        .rate(10)
        .generator((timestamp, index) => {
          const incidentVariant = variants[index % variants.length];
          const variantId = inIncidentWindow(timestamp, incidentStart, incidentEnd)
            ? incidentVariant
            : 'healthy-provider';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-provider-diagnostics',
            sequenceStart: index * 10,
            traceId: `${STORY_ID}-${variantId}-${index}`,
            messages: [
              {
                message: `Provider diagnostic run for ${variantId}`,
                action: 'provider.diagnostic.started',
                extra: { variant_id: variantId },
              },
              {
                message:
                  variantId === 'bedrock-throttled'
                    ? 'Provider request throttled'
                    : variantId === 'truncated-response'
                    ? 'Streaming response truncated'
                    : variantId === 'collector-drop'
                    ? 'Collector dropped part of the AI telemetry'
                    : variantId === 'missing-eval-events'
                    ? 'Evaluation event missing for workflow'
                    : variantId === 'old-semconv-fields'
                    ? 'Legacy semconv field names detected'
                    : 'Provider telemetry healthy',
                action:
                  variantId === 'healthy-provider'
                    ? 'provider.healthy'
                    : 'provider.runtime.anomaly',
                outcome: variantId === 'healthy-provider' ? 'success' : 'failure',
                level: variantId === 'healthy-provider' ? 'info' : 'warn',
                extra: { variant_id: variantId },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_provider_runtime_schema_drift_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_provider_runtime_schema_drift_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
