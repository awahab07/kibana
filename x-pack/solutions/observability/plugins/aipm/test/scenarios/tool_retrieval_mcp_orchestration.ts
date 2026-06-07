/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { generateShortId, type ApmOtelFields, type LogDocument } from '@kbn/synthtrace-client';
import { ApmSynthtracePipelineSchema } from '@kbn/synthtrace-client';
import { getSynthtraceEnvironment, type Scenario, withClient } from '@kbn/synthtrace';
import {
  buildEvaluationSpan,
  buildInternalSpan,
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
const STORY_ID = 'aipm-tool-retrieval-mcp-orchestration';

const scenario: Scenario<ApmOtelFields | LogDocument> = async ({ logger }) => {
  return {
    generate: ({ range, clients: { apmEsClient, logsEsClient } }) => {
      const services = createStoryServices(STORY_ID, ENVIRONMENT);
      const variants = [
        'grounded-success',
        'tool-argument-hallucination',
        'cascading-context',
        'mcp-fanout',
      ];

      const traceEvents = range
        .interval('75s')
        .rate(12)
        .generator((timestamp, index) => {
          const variantId = variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);
          const toolOutcome = variantId === 'tool-argument-hallucination' ? 'failure' : 'success';
          const evalScore =
            variantId === 'cascading-context'
              ? 0.34
              : variantId === 'tool-argument-hallucination'
              ? 0.49
              : 0.91;

          const retrieval = buildInternalSpan({
            instance: services.retriever,
            name: 'retrieval.search_knowledge_graph',
            timestamp: timestamp + 40,
            duration: variantId === 'cascading-context' ? 180 : 110,
            outcome: 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_integ.retrieval.document_count':
                variantId === 'cascading-context' ? 1 : 5,
              'attributes.es_integ.retrieval.result_quality':
                variantId === 'cascading-context' ? 'stale_document' : 'grounded',
              'attributes.es_sdk.workflow.id': ids.workflowId,
            },
          });

          const mcpSpan = buildInternalSpan({
            instance: services.mcpGateway,
            name: 'mcp.invoke.catalog_server',
            timestamp: timestamp + 180,
            duration: variantId === 'mcp-fanout' ? 260 : 120,
            outcome: variantId === 'tool-argument-hallucination' ? 'failure' : 'success',
            extraFields: {
              'attributes.session.id': ids.sessionId,
              'attributes.es_integ.mcp.server_name':
                variantId === 'mcp-fanout' ? 'catalog+pricing' : 'catalog',
              'attributes.es_integ.mcp.call_count': variantId === 'mcp-fanout' ? 3 : 1,
            },
          });

          const toolSpan = buildToolSpan({
            instance: services.toolRunner,
            timestamp: timestamp + 290,
            duration: variantId === 'tool-argument-hallucination' ? 140 : 190,
            outcome: toolOutcome,
            toolName: variantId === 'mcp-fanout' ? 'lookup_pricing' : 'lookup_customer_case',
            identifiers: ids,
            callId: nextToolCallId(STORY_ID, variantId, index),
            argumentsJson:
              variantId === 'tool-argument-hallucination'
                ? JSON.stringify({ customer_name: 'Ada Lovelace', force: true })
                : JSON.stringify({ customer_uuid: `customer-${generateShortId()}` }),
            extraFields: {
              'attributes.es_sdk.tool.validation_error':
                variantId === 'tool-argument-hallucination'
                  ? 'missing customer_uuid; unexpected force parameter'
                  : undefined,
            },
          });

          const modelCall = buildModelCallSpan({
            instance: services.provider,
            timestamp: timestamp + 520,
            duration: variantId === 'mcp-fanout' ? 860 : 710,
            outcome: variantId === 'tool-argument-hallucination' ? 'failure' : 'success',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            inputTokens: variantId === 'mcp-fanout' ? 2400 : 1650,
            cachedInputTokens: 200,
            outputTokens: variantId === 'tool-argument-hallucination' ? 120 : 560,
            cost: variantId === 'mcp-fanout' ? 0.064 : 0.042,
            promptText: 'Use tools to resolve the customer issue with grounded evidence.',
            outputText:
              variantId === 'cascading-context'
                ? 'The agent answered using stale entitlement data.'
                : variantId === 'tool-argument-hallucination'
                ? 'Tool call failed validation before a final answer was produced.'
                : 'The agent resolved the customer issue using retrieved evidence.',
            extraFields: {
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.story.variant': variantId,
            },
          });

          const evaluation = buildEvaluationSpan({
            instance: services.evaluator,
            timestamp: timestamp + 1260,
            duration: 110,
            outcome: evalScore >= 0.7 ? 'success' : 'failure',
            score: evalScore,
            label: evalScore >= 0.7 ? 'grounded' : 'regressed',
            extraFields: {
              'attributes.es_sdk.workflow.id': ids.workflowId,
              'attributes.es_sdk.eval.metric': 'grounded_resolution',
            },
          });

          const root = buildWorkflowRoot({
            instance: services.orchestrator,
            timestamp,
            duration: 1420,
            outcome: evalScore >= 0.7 ? 'success' : 'failure',
            workflowName: 'agent.resolve_case.with_tools',
            provider: 'anthropic',
            model: 'claude-3-7-sonnet',
            identifiers: ids,
            storyLabel: storyTraceLabel(STORY_ID, variantId),
            inputTokens: variantId === 'mcp-fanout' ? 2400 : 1650,
            cachedInputTokens: 200,
            outputTokens: variantId === 'tool-argument-hallucination' ? 120 : 560,
            cost: variantId === 'mcp-fanout' ? 0.064 : 0.042,
            promptText: 'Use tools to resolve the customer issue with grounded evidence.',
            outputText:
              variantId === 'cascading-context'
                ? 'The agent answered using stale entitlement data.'
                : variantId === 'tool-argument-hallucination'
                ? 'Tool call failed validation before a final answer was produced.'
                : 'The agent resolved the customer issue using retrieved evidence.',
            extraFields: {
              'attributes.es_sdk.story.variant': variantId,
            },
          }).children(retrieval, mcpSpan, toolSpan, modelCall, evaluation);

          return root;
        });

      const logEvents = range
        .interval('75s')
        .rate(12)
        .generator((timestamp, index) => {
          const variantId = variants[index % variants.length];
          const ids = createStoryIdentifiers(STORY_ID, index, variantId);

          return buildSessionLogs({
            timestamp,
            identifiers: ids,
            storyId: STORY_ID,
            serviceName: 'aipm-tool-orchestrator',
            sequenceStart: index * 10,
            traceId: `${STORY_ID}-${variantId}-${index}`,
            messages: [
              {
                message: 'Retriever invoked',
                action: 'retrieval.invoked',
                extra: { variant_id: variantId },
              },
              {
                message:
                  variantId === 'tool-argument-hallucination'
                    ? 'Tool validation failed because the model invented arguments'
                    : variantId === 'cascading-context'
                    ? 'Retriever returned stale context that propagated downstream'
                    : 'Tool and MCP execution completed',
                action:
                  variantId === 'tool-argument-hallucination'
                    ? 'tool.validation.failed'
                    : variantId === 'cascading-context'
                    ? 'context.cascaded'
                    : 'tool.completed',
                outcome:
                  variantId === 'grounded-success' || variantId === 'mcp-fanout'
                    ? 'success'
                    : 'failure',
                level:
                  variantId === 'grounded-success' || variantId === 'mcp-fanout' ? 'info' : 'warn',
                extra: { variant_id: variantId },
              },
              {
                message: 'Evaluation written for orchestration run',
                action: 'evaluation.recorded',
                extra: { variant_id: variantId },
              },
            ],
          });
        });

      return [
        withClient(
          apmEsClient,
          logger.perf('generate_aipm_tool_retrieval_mcp_traces', () => traceEvents)
        ),
        withClient(
          logsEsClient,
          logger.perf('generate_aipm_tool_retrieval_mcp_logs', () => logEvents)
        ),
      ];
    },
    setupPipeline: ({ apmEsClient }) =>
      apmEsClient.setPipeline(apmEsClient.resolvePipelineType(ApmSynthtracePipelineSchema.Otel)),
  };
};

export default scenario;
