/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ApmOtelFields, InfraDocument, LogDocument } from '@kbn/synthtrace-client';
import { ApmSynthtracePipelineSchema, infra } from '@kbn/synthtrace-client';
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
const STORY_ID = 'aipm-cross-signal-rollout-capacity';

const scenario: Scenario<ApmOtelFields | LogDocument | InfraDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient, infraEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);
      const host = infra.semconvHost('aipm-canary-node-1');
      const { incidentStart, incidentEnd } = getIncidentWindow(range, 0.5, 0.82);

      const traceEvents = range
        .interval('1m')
        .rate(10)
        .generator((timestamp, index) => {
          const isIncident = inIncidentWindow(timestamp, incidentStart, incidentEnd);
          const variantId = isIncident ? 'canary-overloaded' : 'stable-rollout';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);

          const deploymentSpan = buildInternalSpan({
            instance: services.guardrail,
            name: 'deployment.rollout.check',
            timestamp: timestamp + 15,
            duration: 85,
            outcome: isIncident ? 'failure' : 'success',
            extraFields: {
              'attributes.es_integ.deployment.version': isIncident
                ? '2026.06.0-canary.4'
                : '2026.05.9',
              'attributes.es_integ.deployment.strategy': 'canary',
              'attributes.es_integ.host.name': 'aipm-canary-node-1',
            },
          });

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 120,
            duration: isIncident ? 1900 : 780,
            outcome: isIncident ? 'failure' : 'success',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: isIncident ? 2200 : 1500,
            cachedInputTokens: 180,
            outputTokens: isIncident ? 260 : 520,
            cost: isIncident ? 0.083 : 0.046,
            promptText: 'Summarize the rollout state and impacted services.',
            outputText: isIncident
              ? 'The canary is unstable and increased latency for AI traffic.'
              : 'The rollout is healthy and within latency budget.',
            extraFields: {
              'attributes.es_integ.host.name': 'aipm-canary-node-1',
              'attributes.es_integ.rollout.channel': 'canary',
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: isIncident ? 2350 : 1060,
            outcome: isIncident ? 'failure' : 'success',
            workflowName: 'rollout.capacity.canary_check',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variantId),
            inputTokens: isIncident ? 2200 : 1500,
            cachedInputTokens: 180,
            outputTokens: isIncident ? 260 : 520,
            cost: isIncident ? 0.083 : 0.046,
            promptText: 'Summarize the rollout state and impacted services.',
            outputText: isIncident
              ? 'The canary is unstable and increased latency for AI traffic.'
              : 'The rollout is healthy and within latency budget.',
            extraFields: {
              'attributes.es_integ.host.name': 'aipm-canary-node-1',
              'attributes.es_integ.rollout.channel': 'canary',
              'attributes.es_integ.capacity.incident': isIncident,
            },
          }).children(deploymentSpan, modelCall);

          return root;
        });

      const logEvents = range
        .interval('1m')
        .rate(10)
        .generator((timestamp, index) => {
          const isIncident = inIncidentWindow(timestamp, incidentStart, incidentEnd);
          const variantId = isIncident ? 'canary-overloaded' : 'stable-rollout';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-rollout-monitor',
            sequenceStart: index * 10,
            traceId: `${STORY_ID}-${variantId}-${index}`,
            messages: [
              {
                message: 'Rollout monitor evaluated the current deployment',
                action: 'deployment.checked',
                extra: { variant_id: variantId },
              },
              {
                message: isIncident
                  ? 'Canary overloaded host and exceeded AI latency budget'
                  : 'Canary remained within budget',
                action: isIncident ? 'capacity.alerted' : 'capacity.healthy',
                outcome: isIncident ? 'failure' : 'success',
                level: isIncident ? 'warn' : 'info',
                extra: { host_name: 'aipm-canary-node-1' },
              },
            ],
          });
        });

      const infraEvents = range
        .interval('1m')
        .rate(10)
        .generator((timestamp) => {
          const isIncident = inIncidentWindow(timestamp, incidentStart, incidentEnd);

          return [
            ...host.cpu().map((metric) =>
              metric.timestamp(timestamp).overrides({
                'system.cpu.utilization': isIncident ? 0.96 : 0.42,
                'metrics.system.cpu.utilization': isIncident ? 0.96 : 0.42,
              })
            ),
            ...host.memory().map((metric) =>
              metric.timestamp(timestamp).overrides({
                'system.memory.utilization': isIncident ? 0.91 : 0.56,
              })
            ),
            ...host.network().map((metric) =>
              metric.timestamp(timestamp).overrides({
                'metrics.system.network.io': isIncident ? 950_000_000 : 240_000_000,
              })
            ),
          ];
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_cross_signal_rollout_capacity_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_cross_signal_rollout_capacity_logs', () => logEvents)
        ),
        withClient(
          infraEsClient,
          logger.perf('generate_aipm_cross_signal_rollout_capacity_infra', () => infraEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
