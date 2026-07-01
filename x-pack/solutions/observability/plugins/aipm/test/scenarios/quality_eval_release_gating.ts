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
  buildWorkflowRoot,
  createStoryIdentifiers,
  createStoryServices,
  getIncidentWindow,
  inIncidentWindow,
  storyTraceLabel,
} from './helpers/aipm_story_helpers';

const ENVIRONMENT = getSynthtraceEnvironment(__filename);
const STORY_ID = 'aipm-quality-eval-release-gating';

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);
      const { incidentStart, incidentEnd } = getIncidentWindow(range, 0.58, 0.82);

      const traceEvents = range
        .interval('90s')
        .rate(12)
        .generator((timestamp, index) => {
          const isRegression = inIncidentWindow(timestamp, incidentStart, incidentEnd);
          const variantId = isRegression
            ? 'prompt-v3-2-regressed'
            : index % 4 === 0
            ? 'evaluator-disagreement'
            : 'prompt-v3-1-stable';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);
          const score = isRegression ? 0.46 : variantId === 'evaluator-disagreement' ? 0.68 : 0.92;
          const humanEscalation = isRegression || variantId === 'evaluator-disagreement';
          const model = isRegression ? 'claude-3-5-sonnet' : 'claude-3-7-sonnet';
          const datasetId = 'customer-support-golden-v1';
          const experimentId = isRegression
            ? 'support-eval-2026-06-regression'
            : humanEscalation
            ? 'support-eval-2026-06-review'
            : 'support-eval-2026-05-stable';

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 50,
            duration: isRegression ? 1040 : 920,
            outcome: 'success',
            provider: 'anthropic',
            model,
            identifiers: ids,
            inputTokens: isRegression ? 2100 : 1750,
            outputTokens: isRegression ? 760 : 540,
            cachedInputTokens: 320,
            cost: isRegression ? 0.073 : 0.051,
            promptText: 'Answer the support ticket using only grounded evidence.',
            outputText: isRegression
              ? 'Answer contains unsupported claims about billing entitlement.'
              : 'Answer cites the correct billing entitlement and next action.',
            extraFields: {
              'attributes.es_sdk.prompt.version': isRegression ? '3.2.0' : '3.1.0',
              'attributes.es_sdk.release.version': isRegression ? '2026.06.0' : '2026.05.3',
              'attributes.es_sdk.experiment.id': experimentId,
              'attributes.es_sdk.dataset.id': datasetId,
            },
          });

          const evaluation = buildEvaluationSpan({
            instance: services.evaluator,
            timestamp: timestamp + (isRegression ? 1180 : 990),
            duration: 130,
            outcome: score >= 0.7 ? 'success' : 'failure',
            score,
            label: score >= 0.85 ? 'promote' : score >= 0.65 ? 'manual_review' : 'block_release',
            extraFields: {
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.prompt.version': isRegression ? '3.2.0' : '3.1.0',
              'attributes.es_sdk.eval.metric': 'grounded_accuracy',
              'attributes.es_sdk.eval.requires_human_review': humanEscalation,
              'attributes.es_sdk.experiment.id': experimentId,
              'attributes.es_sdk.dataset.id': datasetId,
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: isRegression ? 1380 : 1180,
            outcome: score >= 0.7 ? 'success' : 'failure',
            workflowName: 'evaluation.release_gate.customer_support',
            provider: 'anthropic',
            model,
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variantId),
            inputTokens: isRegression ? 2100 : 1750,
            cachedInputTokens: 320,
            outputTokens: isRegression ? 760 : 540,
            cost: isRegression ? 0.073 : 0.051,
            promptText: 'Answer the support ticket using only grounded evidence.',
            outputText: isRegression
              ? 'Answer contains unsupported claims about billing entitlement.'
              : 'Answer cites the correct billing entitlement and next action.',
            extraFields: {
              'attributes.es_sdk.prompt.version': isRegression ? '3.2.0' : '3.1.0',
              'attributes.es_sdk.release.version': isRegression ? '2026.06.0' : '2026.05.3',
              'attributes.es_sdk.release.gate': humanEscalation ? 'hold' : 'auto_promote',
              'attributes.es_sdk.experiment.id': experimentId,
              'attributes.es_sdk.dataset.id': datasetId,
            },
          }).children(modelCall, evaluation);

          return root;
        });

      const logEvents = range
        .interval('90s')
        .rate(12)
        .generator((timestamp, index) => {
          const isRegression = inIncidentWindow(timestamp, incidentStart, incidentEnd);
          const variantId = isRegression
            ? 'prompt-v3-2-regressed'
            : index % 4 === 0
            ? 'evaluator-disagreement'
            : 'prompt-v3-1-stable';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);
          const score = isRegression ? 0.46 : variantId === 'evaluator-disagreement' ? 0.68 : 0.92;
          const experimentId = isRegression
            ? 'support-eval-2026-06-regression'
            : variantId === 'evaluator-disagreement'
            ? 'support-eval-2026-06-review'
            : 'support-eval-2026-05-stable';

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-evaluation-gate',
            sequenceStart: index * 10,
            traceId: `${STORY_ID}-${variantId}-${index}`,
            messages: [
              {
                message: `Offline eval batch executed for ${variantId}`,
                action: 'eval.batch.executed',
                extra: {
                  prompt_version: isRegression ? '3.2.0' : '3.1.0',
                  evaluation_score: score,
                  experiment_id: experimentId,
                  dataset_id: 'customer-support-golden-v1',
                },
              },
              {
                message:
                  score >= 0.85
                    ? 'Release gate approved'
                    : score >= 0.65
                    ? 'Release gate requires review'
                    : 'Release gate blocked',
                action: 'release.gate.updated',
                outcome: score >= 0.65 ? 'success' : 'failure',
                level: score >= 0.65 ? 'info' : 'warn',
                extra: {
                  gate_decision: score >= 0.85 ? 'approve' : score >= 0.65 ? 'review' : 'block',
                  score,
                  experiment_id: experimentId,
                },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_quality_eval_release_gate_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_quality_eval_release_gate_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
