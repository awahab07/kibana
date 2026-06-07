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
  storyTraceLabel,
} from './helpers/aipm_story_helpers';

const ENVIRONMENT = getSynthtraceEnvironment(__filename);
const STORY_ID = 'aipm-session-reconstruction-audit';

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);

      const traceEvents = range
        .interval('2m')
        .rate(8)
        .generator((timestamp, index) => {
          const variantId =
            index % 3 === 0
              ? 'redacted-session'
              : index % 3 === 1
              ? 'full-session'
              : 'long-session';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);
          const isRedacted = variantId === 'redacted-session';
          const isLongSession = variantId === 'long-session';

          const guardrail = buildInternalSpan({
            instance: services.guardrail,
            name: 'guardrail.audit_redaction',
            timestamp: timestamp + 20,
            duration: 70,
            outcome: 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_integ.guardrail.category': isRedacted
                ? 'pii_redaction'
                : 'allow_full_content',
              'attributes.es_sdk.workflow.id': ids.workflowId,
            },
          });

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 110,
            duration: isLongSession ? 1280 : 760,
            outcome: 'success',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: isLongSession ? 3200 : 1400,
            cachedInputTokens: 260,
            outputTokens: isLongSession ? 980 : 420,
            cost: isLongSession ? 0.087 : 0.032,
            promptText: isRedacted
              ? '[REDACTED USER PROMPT]'
              : 'Explain the failed deployment and next remediation step.',
            outputText: isRedacted
              ? '[REDACTED MODEL OUTPUT]'
              : 'The deployment failed because the canary exceeded the latency budget.',
            extraFields: {
              'attributes.es_sdk.audit.redacted': isRedacted,
              'attributes.es_sdk.audit.turn_count': isLongSession ? 12 : 3,
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: isLongSession ? 1660 : 980,
            outcome: 'success',
            workflowName: 'session.reconstruct.agent_support',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variantId),
            inputTokens: isLongSession ? 3200 : 1400,
            cachedInputTokens: 260,
            outputTokens: isLongSession ? 980 : 420,
            cost: isLongSession ? 0.087 : 0.032,
            promptText: isRedacted
              ? '[REDACTED USER PROMPT]'
              : 'Explain the failed deployment and next remediation step.',
            outputText: isRedacted
              ? '[REDACTED MODEL OUTPUT]'
              : 'The deployment failed because the canary exceeded the latency budget.',
            extraFields: {
              'attributes.es_sdk.audit.redacted': isRedacted,
              'attributes.es_sdk.session.turn_count': isLongSession ? 12 : 3,
              'attributes.es_sdk.session.timeline_required': true,
            },
          }).children(guardrail, modelCall);

          return root;
        });

      const logEvents = range
        .interval('2m')
        .rate(8)
        .generator((timestamp, index) => {
          const variantId =
            index % 3 === 0
              ? 'redacted-session'
              : index % 3 === 1
              ? 'full-session'
              : 'long-session';
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);
          const isRedacted = variantId === 'redacted-session';
          const isLongSession = variantId === 'long-session';

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-session-audit',
            sequenceStart: index * 10,
            traceId: `${STORY_ID}-${variantId}-${index}`,
            messages: [
              {
                message: 'Session opened',
                action: 'session.opened',
                extra: { turn_count: isLongSession ? 12 : 3 },
              },
              {
                message: isRedacted
                  ? 'Prompt captured in redacted mode'
                  : 'Prompt captured with full content',
                action: 'prompt.captured',
                extra: { redacted: isRedacted, prompt_id: ids.promptId },
              },
              {
                message: 'Assistant response captured',
                action: 'assistant.responded',
                extra: { conversation_id: ids.conversationId, user_email: ids.userEmail },
              },
              {
                message: 'Audit timeline materialized for session view',
                action: 'audit.timeline.materialized',
                extra: { organization_id: ids.organizationId },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_session_reconstruction_audit_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_session_reconstruction_audit_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
