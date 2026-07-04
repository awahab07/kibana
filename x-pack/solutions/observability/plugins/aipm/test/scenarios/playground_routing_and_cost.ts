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
  buildEvaluationSpan,
  buildInternalSpan,
  buildModelCallSpan,
  buildSessionLogs,
  buildWorkflowRoot,
  createStoryIdentifiers,
  createStoryServices,
  storyTraceLabel,
} from './helpers/aipm_story_helpers';

const ENVIRONMENT = getSynthtraceEnvironment(__filename);
const STORY_ID = 'aipm-playground-routing-cost';

const variants = [
  {
    id: 'claude-sonnet',
    provider: 'anthropic',
    model: 'claude-3-7-sonnet',
    inputTokens: 1800,
    cachedInputTokens: 250,
    outputTokens: 640,
    cost: 0.061,
    modelDuration: 1100,
    totalDuration: 1500,
    score: 0.94,
    routeReason: 'premium_quality',
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputTokens: 1250,
    cachedInputTokens: 420,
    outputTokens: 420,
    cost: 0.023,
    modelDuration: 780,
    totalDuration: 1150,
    score: 0.89,
    routeReason: 'latency_cost_balance',
  },
  {
    id: 'bedrock-haiku',
    provider: 'bedrock',
    model: 'claude-3-5-haiku',
    inputTokens: 980,
    cachedInputTokens: 540,
    outputTokens: 280,
    cost: 0.012,
    modelDuration: 540,
    totalDuration: 880,
    score: 0.82,
    routeReason: 'budget_mode',
  },
];

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);
      const routeShiftStart =
        range.from.getTime() + (range.to.getTime() - range.from.getTime()) * 0.55;

      const traceEvents = range
        .interval('1m')
        .rate(15)
        .generator((timestamp, index) => {
          const variant =
            timestamp >= routeShiftStart && index % 4 !== 0
              ? variants[2]
              : variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variant.id);
          const playgroundSessionId = `playground-customer-support-${Math.floor(
            index / variants.length
          )}`;

          const retrieval = buildInternalSpan({
            instance: services.retriever,
            name: 'retrieval.customer_support_kb',
            timestamp: timestamp + 25,
            duration: 120,
            outcome: 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_integ.retrieval.document_count': 6,
              'attributes.es_integ.retrieval.cache_hit': variant.cachedInputTokens > 0,
              'attributes.es_sdk.workflow.id': ids.workflowId,
            },
          });

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 180,
            duration: variant.modelDuration,
            outcome: 'success',
            provider: variant.provider,
            model: variant.model,
            identifiers: ids,
            inputTokens: variant.inputTokens,
            cachedInputTokens: variant.cachedInputTokens,
            outputTokens: variant.outputTokens,
            cost: variant.cost,
            promptText: 'Summarize the incident and propose the next action for the customer.',
            outputText: `Variant ${variant.id} produced a customer-safe summary.`,
            extraFields: {
              'attributes.es_sdk.route.reason': variant.routeReason,
              'attributes.es_sdk.story.bucket':
                timestamp >= routeShiftStart ? 'shifted_route' : 'baseline_route',
              'attributes.es_sdk.playground.session_id': playgroundSessionId,
            },
          });

          const evaluation = buildEvaluationSpan({
            instance: services.evaluator,
            timestamp: timestamp + variant.totalDuration - 140,
            duration: 95,
            outcome: 'success',
            score: variant.score,
            label: variant.score > 0.9 ? 'promote_candidate' : 'keep_observing',
            extraFields: {
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.eval.metric': 'grounded_helpfulness',
              'attributes.es_sdk.playground.session_id': playgroundSessionId,
              'attributes.es_sdk.playground.promotion_candidate': variant.score > 0.9,
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: variant.totalDuration,
            outcome: 'success',
            workflowName: 'playground.compare.customer_support',
            provider: variant.provider,
            model: variant.model,
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variant.id),
            inputTokens: variant.inputTokens,
            cachedInputTokens: variant.cachedInputTokens,
            outputTokens: variant.outputTokens,
            cost: variant.cost,
            promptText: 'Summarize the incident and propose the next action for the customer.',
            outputText: `Variant ${variant.id} produced a customer-safe summary.`,
            extraFields: {
              'attributes.es_sdk.route.reason': variant.routeReason,
              'attributes.es_sdk.playground.surface': 'customer_support',
              'attributes.es_sdk.playground.session_id': playgroundSessionId,
              'attributes.es_sdk.playground.promotion_candidate': variant.score > 0.9,
            },
          }).children(retrieval, modelCall, evaluation);

          return root;
        });

      const logEvents = range
        .interval('1m')
        .rate(15)
        .generator((timestamp, index) => {
          const variant =
            timestamp >= routeShiftStart && index % 4 !== 0
              ? variants[2]
              : variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variant.id);
          const traceId = `playground-${variant.id}-${index}`;
          const playgroundSessionId = `playground-customer-support-${Math.floor(
            index / variants.length
          )}`;

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-playground-router',
            sequenceStart: index * 10,
            traceId,
            messages: [
              {
                message: `Prompt accepted for ${variant.id}`,
                action: 'prompt.accepted',
                extra: { provider: variant.provider, model: variant.model },
              },
              {
                message: `Router selected ${variant.id}`,
                action: 'route.selected',
                extra: {
                  provider: variant.provider,
                  model: variant.model,
                  route_reason: variant.routeReason,
                  playground_session_id: playgroundSessionId,
                },
              },
              {
                message: `Evaluation score ${variant.score.toFixed(2)} recorded`,
                action: 'evaluation.recorded',
                extra: {
                  evaluation_score: variant.score,
                  input_tokens: variant.inputTokens,
                  cached_input_tokens: variant.cachedInputTokens,
                  output_tokens: variant.outputTokens,
                  cost: variant.cost,
                  promotion_candidate: variant.score > 0.9,
                },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_playground_routing_cost_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_playground_routing_cost_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
