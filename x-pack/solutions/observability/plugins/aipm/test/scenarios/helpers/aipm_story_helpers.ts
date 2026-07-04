/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  apm,
  generateLongId,
  type ApmOtelFields,
  type LogDocument,
  log,
  type OtelInstance,
} from '@kbn/synthtrace-client';

type Outcome = 'success' | 'failure' | 'unknown';

export interface StoryIdentifiers {
  storyId: string;
  variantId: string;
  workflowId: string;
  sessionId: string;
  promptId: string;
  conversationId: string;
  userEmail: string;
  organizationId: string;
}

export interface StoryServices {
  orchestrator: OtelInstance;
  provider: OtelInstance;
  retriever: OtelInstance;
  toolRunner: OtelInstance;
  mcpGateway: OtelInstance;
  evaluator: OtelInstance;
  guardrail: OtelInstance;
}

type OtelFieldsWithCustom = Partial<ApmOtelFields> & Record<string, unknown>;

export function createStoryIdentifiers(
  storyId: string,
  index: number,
  variantId: string
): StoryIdentifiers {
  return {
    storyId,
    variantId,
    workflowId: `${storyId}-workflow-${index}`,
    sessionId: `${storyId}-session-${Math.floor(index / 3)}`,
    promptId: `${storyId}-prompt-${index}`,
    conversationId: `${storyId}-conversation-${Math.floor(index / 2)}`,
    userEmail: `user-${Math.floor(index % 7)}@example.ai`,
    organizationId: `org-${Math.floor(index % 3)}`,
  };
}

export function createStoryServices(storyId: string, environment: string): StoryServices {
  const namespace = `${environment}.aipm`;

  const service = (name: string, sdkName: 'opentelemetry' | 'otlp' = 'opentelemetry') =>
    apm
      .otelService({
        name: `aipm-${storyId}-${name}`,
        namespace,
        sdkLanguage: 'nodejs',
        sdkName,
      })
      .instance(`${storyId}-${name}-instance`);

  return {
    orchestrator: service('orchestrator'),
    provider: service('provider', 'otlp'),
    retriever: service('retriever'),
    toolRunner: service('tool-runner'),
    mcpGateway: service('mcp-gateway'),
    evaluator: service('evaluator'),
    guardrail: service('guardrail'),
  };
}

export function inIncidentWindow(
  timestamp: number,
  incidentStart: number,
  incidentEnd: number
): boolean {
  return timestamp >= incidentStart && timestamp <= incidentEnd;
}

export function getIncidentWindow(
  range: { from: Date; to: Date },
  startRatio: number,
  endRatio: number
) {
  const span = range.to.getTime() - range.from.getTime();
  return {
    incidentStart: range.from.getTime() + span * startRatio,
    incidentEnd: range.from.getTime() + span * endRatio,
  };
}

export function withOtelFields<T extends { overrides(fields: Partial<ApmOtelFields>): T }>(
  entity: T,
  fields: OtelFieldsWithCustom
): T {
  return entity.overrides(fields as Partial<ApmOtelFields>);
}

export function buildWorkflowRoot({
  instance,
  timestamp,
  duration,
  outcome,
  workflowName,
  provider,
  model,
  identifiers,
  storyLabel,
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
  cost,
  promptText,
  outputText,
  extraFields = {},
}: {
  instance: OtelInstance;
  timestamp: number;
  duration: number;
  outcome: Outcome;
  workflowName: string;
  provider: string;
  model: string;
  identifiers: StoryIdentifiers;
  storyLabel: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cost: number;
  promptText?: string;
  outputText?: string;
  extraFields?: OtelFieldsWithCustom;
}) {
  const root = instance
    .span({
      name: workflowName,
      kind: 'Server',
    })
    .timestamp(timestamp)
    .duration(duration)
    .outcome(outcome);

  return withOtelFields(root, {
    'attributes.session.id': identifiers.sessionId,
    'attributes.gen_ai.operation.name': 'chat',
    'attributes.gen_ai.provider.name': provider,
    'attributes.gen_ai.request.model': model,
    'attributes.gen_ai.response.model': model,
    'attributes.gen_ai.system': provider,
    'attributes.gen_ai.usage.input_tokens': inputTokens,
    'attributes.gen_ai.usage.cached_input_tokens': cachedInputTokens,
    'attributes.gen_ai.usage.output_tokens': outputTokens,
    'attributes.gen_ai.usage.cost': cost,
    'attributes.gen_ai.conversation.id': identifiers.conversationId,
    'attributes.gen_ai.prompt.id': identifiers.promptId,
    'attributes.es_sdk.story.id': identifiers.storyId,
    'attributes.es_sdk.story.label': storyLabel,
    'attributes.es_sdk.workflow.id': identifiers.workflowId,
    'attributes.es_sdk.variant.id': identifiers.variantId,
    'attributes.es_sdk.user.email': identifiers.userEmail,
    'attributes.es_sdk.organization.id': identifiers.organizationId,
    ...(promptText ? { 'input.value': promptText } : {}),
    ...(outputText ? { 'output.value': outputText } : {}),
    ...extraFields,
  });
}

export function buildModelCallSpan({
  instance,
  timestamp,
  duration,
  outcome,
  provider,
  model,
  identifiers,
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
  cost,
  promptText,
  outputText,
  extraFields = {},
}: {
  instance: OtelInstance;
  timestamp: number;
  duration: number;
  outcome: Outcome;
  provider: string;
  model: string;
  identifiers: StoryIdentifiers;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cost: number;
  promptText?: string;
  outputText?: string;
  extraFields?: OtelFieldsWithCustom;
}) {
  const span = instance
    .httpExitSpan({
      name: `POST ${provider} /chat`,
      destinationUrl: `https://${provider}.example.ai/v1/chat`,
    })
    .timestamp(timestamp)
    .duration(duration)
    .outcome(outcome);

  return withOtelFields(span, {
    'attributes.session.id': identifiers.sessionId,
    'attributes.gen_ai.operation.name': 'chat',
    'attributes.gen_ai.provider.name': provider,
    'attributes.gen_ai.request.model': model,
    'attributes.gen_ai.response.model': model,
    'attributes.gen_ai.system': provider,
    'attributes.gen_ai.usage.input_tokens': inputTokens,
    'attributes.gen_ai.usage.cached_input_tokens': cachedInputTokens,
    'attributes.gen_ai.usage.output_tokens': outputTokens,
    'attributes.gen_ai.usage.cost': cost,
    'attributes.gen_ai.conversation.id': identifiers.conversationId,
    'attributes.gen_ai.prompt.id': identifiers.promptId,
    'attributes.gen_ai.output.type': 'text',
    'attributes.es_sdk.story.id': identifiers.storyId,
    'attributes.es_sdk.variant.id': identifiers.variantId,
    ...(promptText ? { 'input.value': promptText } : {}),
    ...(outputText ? { 'output.value': outputText } : {}),
    ...extraFields,
  });
}

export function buildInternalSpan({
  instance,
  name,
  timestamp,
  duration,
  outcome,
  extraFields = {},
}: {
  instance: OtelInstance;
  name: string;
  timestamp: number;
  duration: number;
  outcome: Outcome;
  extraFields?: OtelFieldsWithCustom;
}) {
  const span = instance
    .span({
      name,
      kind: 'Internal',
    })
    .timestamp(timestamp)
    .duration(duration)
    .outcome(outcome);

  return withOtelFields(span, extraFields);
}

export function buildToolSpan({
  instance,
  timestamp,
  duration,
  outcome,
  toolName,
  identifiers,
  callId,
  argumentsJson,
  extraFields = {},
}: {
  instance: OtelInstance;
  timestamp: number;
  duration: number;
  outcome: Outcome;
  toolName: string;
  identifiers: StoryIdentifiers;
  callId: string;
  argumentsJson: string;
  extraFields?: OtelFieldsWithCustom;
}) {
  return buildInternalSpan({
    instance,
    name: `tool:${toolName}`,
    timestamp,
    duration,
    outcome,
    extraFields: {
      'attributes.session.id': identifiers.sessionId,
      'attributes.gen_ai.operation.name': 'execute_tool',
      'attributes.gen_ai.tool.name': toolName,
      'attributes.gen_ai.tool.call.id': callId,
      'attributes.es_sdk.story.id': identifiers.storyId,
      'attributes.es_sdk.variant.id': identifiers.variantId,
      'attributes.es_sdk.tool.arguments': argumentsJson,
      ...extraFields,
    },
  });
}

export function buildEvaluationSpan({
  instance,
  timestamp,
  duration,
  outcome,
  score,
  label,
  extraFields = {},
}: {
  instance: OtelInstance;
  timestamp: number;
  duration: number;
  outcome: Outcome;
  score: number;
  label: string;
  extraFields?: OtelFieldsWithCustom;
}) {
  return buildInternalSpan({
    instance,
    name: 'evaluation.score',
    timestamp,
    duration,
    outcome,
    extraFields: {
      'attributes.es_sdk.evaluation.score': score,
      'attributes.es_sdk.evaluation.label': label,
      ...extraFields,
    },
  });
}

export function buildSessionLogs({
  timestamp,
  identifiers,
  storyId,
  serviceName,
  sequenceStart,
  traceId,
  messages,
}: {
  timestamp: number;
  identifiers: StoryIdentifiers;
  storyId: string;
  serviceName: string;
  sequenceStart: number;
  traceId: string;
  messages: Array<{
    message: string;
    action: string;
    outcome?: string;
    level?: string;
    extra?: Record<string, unknown>;
  }>;
}) {
  return messages.map((entry, index) =>
    log
      .createMinimal({
        dataset: 'aipm.session',
        namespace: 'default',
      })
      .timestamp(timestamp + index)
      .message(entry.message)
      .defaults({
        'service.name': serviceName,
        'trace.id': traceId,
        'session.id': identifiers.sessionId,
        'event.sequence': sequenceStart + index,
        'event.action': entry.action,
        'event.outcome': entry.outcome ?? 'success',
        'log.level': entry.level ?? 'info',
        'log.custom': {
          story_id: storyId,
          workflow_id: identifiers.workflowId,
          prompt_id: identifiers.promptId,
          conversation_id: identifiers.conversationId,
          user_email: identifiers.userEmail,
          organization_id: identifiers.organizationId,
          variant_id: identifiers.variantId,
          ...(entry.extra ?? {}),
        },
      } as LogDocument)
  );
}

export function storyTraceLabel(storyId: string, variantId: string) {
  return `${storyId}:${variantId}`;
}

export function nextToolCallId(storyId: string, variantId: string, index: number) {
  return `${storyId}-${variantId}-tool-${index}`;
}

export function newTraceCorrelationId() {
  return generateLongId();
}
