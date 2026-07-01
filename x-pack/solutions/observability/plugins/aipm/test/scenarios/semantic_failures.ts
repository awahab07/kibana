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
  buildModelCallSpan,
  buildSessionLogs,
  buildToolSpan,
  buildWorkflowRoot,
  createStoryIdentifiers,
  createStoryServices,
  nextToolCallId,
  storyTraceLabel,
} from './helpers/aipm_story_helpers';

const ENVIRONMENT = getSynthtraceEnvironment(__filename);
const STORY_ID = 'aipm-semantic-failures';

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);
      const variants = ['infinite-loop', 'loop-broken', 'goal-drift', 'forgotten-action'];

      const traceEvents = range
        .interval('70s')
        .rate(10)
        .generator((timestamp, index) => {
          const variantId = variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);
          const loopCount = variantId === 'infinite-loop' ? 4 : variantId === 'loop-broken' ? 3 : 1;
          const childSpans = Array.from({ length: loopCount }, (_, loopIndex) =>
            buildToolSpan({
              instance: services.toolRunner,
              timestamp: timestamp + 60 + loopIndex * 120,
              duration: 95,
              outcome:
                variantId === 'loop-broken' && loopIndex === loopCount - 1 ? 'success' : 'failure',
              toolName: 'search_customer_entitlements',
              identifiers: ids,
              callId: nextToolCallId(STORY_ID, variantId, loopIndex),
              argumentsJson: JSON.stringify({
                entitlement_query: 'billing issue',
                retry: loopIndex + 1,
              }),
              extraFields: {
                'attributes.es_sdk.semantic_failure.loop_iteration': loopIndex + 1,
              },
            })
          );

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 610,
            duration: variantId === 'goal-drift' ? 980 : 760,
            outcome:
              variantId === 'forgotten-action' || variantId === 'infinite-loop'
                ? 'failure'
                : 'success',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: variantId === 'infinite-loop' ? 4100 : 1900,
            cachedInputTokens: 0,
            outputTokens: variantId === 'forgotten-action' ? 180 : 520,
            cost: variantId === 'infinite-loop' ? 0.097 : 0.049,
            promptText: 'Analyze the report and email a concise summary to the customer.',
            outputText:
              variantId === 'goal-drift'
                ? 'The agent analyzed compliance findings and never sent the email.'
                : variantId === 'forgotten-action'
                ? 'The agent prepared a summary but omitted the send-email action.'
                : variantId === 'infinite-loop'
                ? 'The agent kept calling the same tool without converging.'
                : 'The agent broke the loop and completed the response.',
            extraFields: {
              'attributes.es_sdk.semantic_failure.mode': variantId,
            },
          });

          const evaluation = buildEvaluationSpan({
            instance: services.evaluator,
            timestamp: timestamp + 1460,
            duration: 95,
            outcome: variantId === 'loop-broken' ? 'success' : 'failure',
            score: variantId === 'loop-broken' ? 0.82 : variantId === 'goal-drift' ? 0.31 : 0.22,
            label: variantId === 'loop-broken' ? 'completed_goal' : 'semantic_failure',
            extraFields: {
              'attributes.es_sdk.semantic_failure.mode': variantId,
              'attributes.es_sdk.goal.completed': variantId === 'loop-broken',
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: 1610,
            outcome: variantId === 'loop-broken' ? 'success' : 'failure',
            workflowName: 'agent.semantic_failure.exercise',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variantId),
            inputTokens: variantId === 'infinite-loop' ? 4100 : 1900,
            cachedInputTokens: 0,
            outputTokens: variantId === 'forgotten-action' ? 180 : 520,
            cost: variantId === 'infinite-loop' ? 0.097 : 0.049,
            promptText: 'Analyze the report and email a concise summary to the customer.',
            outputText:
              variantId === 'goal-drift'
                ? 'The agent analyzed compliance findings and never sent the email.'
                : variantId === 'forgotten-action'
                ? 'The agent prepared a summary but omitted the send-email action.'
                : variantId === 'infinite-loop'
                ? 'The agent kept calling the same tool without converging.'
                : 'The agent broke the loop and completed the response.',
            extraFields: {
              'attributes.es_sdk.semantic_failure.mode': variantId,
            },
          }).children(...childSpans, modelCall, evaluation);

          return root;
        });

      const logEvents = range
        .interval('70s')
        .rate(10)
        .generator((timestamp, index) => {
          const variantId = variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-semantic-failure-monitor',
            sequenceStart: index * 10,
            traceId: `${STORY_ID}-${variantId}-${index}`,
            messages: [
              {
                message: 'Agent session started',
                action: 'agent.session.started',
                extra: { variant_id: variantId },
              },
              {
                message:
                  variantId === 'infinite-loop'
                    ? 'Repeated identical tool calls detected'
                    : variantId === 'goal-drift'
                    ? 'Agent drifted toward an intermediate goal'
                    : variantId === 'forgotten-action'
                    ? 'Agent forgot the terminal action'
                    : 'Loop broken and terminal action completed',
                action:
                  variantId === 'loop-broken'
                    ? 'agent.goal.completed'
                    : 'agent.semantic_failure.detected',
                outcome: variantId === 'loop-broken' ? 'success' : 'failure',
                level: variantId === 'loop-broken' ? 'info' : 'warn',
                extra: { variant_id: variantId },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_semantic_failure_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_semantic_failure_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
