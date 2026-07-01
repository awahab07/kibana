/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type {
  AipmTraceEntityCounts,
  AipmTraceMapEdge,
  AipmTraceMapNode,
  AipmTraceSessionEvent,
  AipmTraceDetailRouteResponse,
  AipmTraceListItem,
  AipmTraceListRouteResponse,
  AipmTraceSummary,
  AipmTraceWaterfallItem,
} from '../../common';

const TRACE_INDEX_PATTERN = ['traces-apm*', 'traces-*.otel*'];
const LOG_INDEX_PATTERN = ['logs-aipm.session*'];
const DEFAULT_TRACE_STORY_ID = 'aipm-fullstack-llm-journey';
const DEFAULT_TRACE_STORY_LABEL = 'Full-stack LLM journey';
const MAX_ROOT_TRACE_DOCS = 24;
const MAX_TRACE_DOCS_FOR_COUNTS = 400;
const MAX_TRACE_DETAIL_DOCS = 120;
const MAX_LOG_DETAIL_DOCS = 80;

type AnyDocument = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readField(source: AnyDocument, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = source;

  for (let index = 0; index < segments.length; index += 1) {
    if (!isRecord(current)) {
      return undefined;
    }

    const remainingPath = segments.slice(index).join('.');
    if (remainingPath in current) {
      return current[remainingPath];
    }

    current = current[segments[index]];
  }

  return current;
}

function readString(source: AnyDocument, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = readField(source, path);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function readNumber(source: AnyDocument, paths: string[]): number | undefined {
  for (const path of paths) {
    const value = readField(source, path);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function asBadgeList(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.length > 0));
}

function uniqueCount(values: Array<string | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function formatDurationUs(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}s`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}ms`;
  }

  return `${value.toFixed(0)}us`;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

function buildApmQuery(serviceName: string | undefined, traceId: string) {
  if (serviceName) {
    return `trace.id : "${traceId}" and service.name : "${serviceName}"`;
  }

  return `trace.id : "${traceId}"`;
}

function previewText(value: string | undefined, limit = 120) {
  if (!value) {
    return undefined;
  }

  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function getTraceId(source: AnyDocument) {
  return readString(source, ['trace_id', 'trace.id']) ?? 'unknown-trace';
}

function getSpanId(source: AnyDocument) {
  return readString(source, ['span_id', 'span.id']);
}

function getParentSpanId(source: AnyDocument) {
  return readString(source, ['parent_span_id', 'parent.id']);
}

function getStepId(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.map.step_id']);
}

function getParentStepId(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.map.parent_step_id']);
}

function getNodeKind(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.map.node_kind']) ?? 'service';
}

function getNodeLabel(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.map.label']) ?? getWorkflowName(source);
}

function getNodeSummary(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.map.response.summary', 'output.value']);
}

function getNodeWarning(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.map.warning']);
}

function getServiceName(source: AnyDocument) {
  return readString(source, [
    'service.name',
    'attributes.service.name',
    'resource.attributes.service.name',
  ]);
}

function getWorkflowName(source: AnyDocument) {
  return readString(source, ['name', 'transaction.name', 'span.name']) ?? 'Workflow execution';
}

function getOutcome(source: AnyDocument) {
  return readString(source, ['attributes.event.outcome', 'event.outcome']) ?? 'unknown';
}

function getDurationUs(source: AnyDocument) {
  return readNumber(source, ['duration', 'span.duration.us', 'transaction.duration.us']) ?? 0;
}

function getTimestampUs(source: AnyDocument) {
  const timestampUs = readNumber(source, ['attributes.timestamp.us', 'timestamp.us']);
  if (timestampUs !== undefined) {
    return timestampUs;
  }

  const timestamp = readString(source, ['@timestamp']);
  if (timestamp) {
    return Date.parse(timestamp) * 1000;
  }

  return 0;
}

function getTimestampIso(source: AnyDocument) {
  return (
    readString(source, ['@timestamp']) ?? new Date(getTimestampUs(source) / 1000).toISOString()
  );
}

function getProvider(source: AnyDocument) {
  return readString(source, ['attributes.gen_ai.provider.name']);
}

function getModel(source: AnyDocument) {
  return readString(source, [
    'attributes.gen_ai.response.model',
    'attributes.gen_ai.request.model',
  ]);
}

function getWorkflowId(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.workflow.id', 'log.custom.workflow_id']) ?? '';
}

function getStoryId(source: AnyDocument) {
  return (
    readString(source, ['attributes.es_sdk.story.id', 'log.custom.story_id']) ??
    DEFAULT_TRACE_STORY_ID
  );
}

function getStoryLabel(source: AnyDocument) {
  return (
    readString(source, ['attributes.es_sdk.story.label', 'attributes.es_sdk.variant.id']) ??
    DEFAULT_TRACE_STORY_LABEL
  );
}

function getSessionId(source: AnyDocument) {
  return readString(source, ['attributes.session.id', 'session.id']) ?? '';
}

function getInputTokens(source: AnyDocument) {
  return Math.round(readNumber(source, ['attributes.gen_ai.usage.input_tokens']) ?? 0);
}

function getOutputTokens(source: AnyDocument) {
  return Math.round(readNumber(source, ['attributes.gen_ai.usage.output_tokens']) ?? 0);
}

function getCost(source: AnyDocument) {
  return readNumber(source, ['attributes.gen_ai.usage.cost', 'attributes.es_sdk.total.cost']) ?? 0;
}

function getEvaluationScore(source: AnyDocument) {
  return readNumber(source, ['attributes.es_sdk.evaluation.score', 'attributes.es_sdk.eval.score']);
}

function getEvaluationLabel(source: AnyDocument) {
  return readString(source, [
    'attributes.es_sdk.evaluation.label',
    'attributes.es_sdk.evaluation.label',
  ]);
}

function getUserRating(source: AnyDocument) {
  return readString(source, ['attributes.es_sdk.feedback.rating']);
}

function getPromptText(source: AnyDocument) {
  return readString(source, ['input.value']);
}

function getAnswerText(source: AnyDocument) {
  return readString(source, ['output.value']);
}

function getToolName(source: AnyDocument) {
  return readString(source, ['attributes.gen_ai.tool.name']);
}

function getMcpServerName(source: AnyDocument) {
  return readString(source, ['attributes.es_integ.mcp.server_name']);
}

function formatRating(rating: string | undefined) {
  if (!rating) {
    return undefined;
  }

  return rating === 'thumbs_up' ? 'thumbs up' : rating === 'thumbs_down' ? 'thumbs down' : rating;
}

function formatEdgeLabel({
  durationUs,
  inputTokens,
  outputTokens,
  cost,
}: {
  durationUs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}) {
  const parts = [
    durationUs && durationUs > 0 ? formatDurationUs(durationUs) : undefined,
    inputTokens && inputTokens > 0 ? `${inputTokens} in` : undefined,
    outputTokens && outputTokens > 0 ? `${outputTokens} out` : undefined,
    cost && cost > 0 ? formatCurrency(cost) : undefined,
  ].filter((value): value is string => Boolean(value));

  return parts.join(' • ') || 'flow';
}

async function searchRootTraces(esClient: ElasticsearchClient) {
  const response = await esClient.search<AnyDocument>({
    index: TRACE_INDEX_PATTERN,
    size: MAX_ROOT_TRACE_DOCS,
    sort: [{ '@timestamp': { order: 'desc' } }],
    track_total_hits: false,
    query: {
      bool: {
        filter: [
          { range: { '@timestamp': { gte: 'now-30d' } } },
          { term: { 'attributes.es_sdk.story.id': DEFAULT_TRACE_STORY_ID } },
          { term: { kind: 'Server' } },
        ],
      },
    },
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((source): source is AnyDocument => Boolean(source));
}

async function searchTraceDocs(esClient: ElasticsearchClient) {
  const response = await esClient.search<AnyDocument>({
    index: TRACE_INDEX_PATTERN,
    size: MAX_TRACE_DOCS_FOR_COUNTS,
    sort: [{ '@timestamp': { order: 'desc' } }],
    track_total_hits: false,
    query: {
      bool: {
        filter: [
          { range: { '@timestamp': { gte: 'now-30d' } } },
          { term: { 'attributes.es_sdk.story.id': DEFAULT_TRACE_STORY_ID } },
        ],
      },
    },
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((source): source is AnyDocument => Boolean(source));
}

async function searchTraceDetailDocs(esClient: ElasticsearchClient, traceId: string) {
  const response = await esClient.search<AnyDocument>({
    index: TRACE_INDEX_PATTERN,
    size: MAX_TRACE_DETAIL_DOCS,
    sort: [
      { 'attributes.timestamp.us': { order: 'asc', unmapped_type: 'long' } },
      { '@timestamp': { order: 'asc' } },
    ],
    track_total_hits: false,
    query: {
      bool: {
        filter: [
          { range: { '@timestamp': { gte: 'now-30d' } } },
          { term: { 'attributes.es_sdk.story.id': DEFAULT_TRACE_STORY_ID } },
          { term: { trace_id: traceId } },
        ],
      },
    },
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((source): source is AnyDocument => Boolean(source));
}

async function searchTraceDetailLogs(esClient: ElasticsearchClient, traceId: string) {
  const response = await esClient.search<AnyDocument>({
    index: LOG_INDEX_PATTERN,
    size: MAX_LOG_DETAIL_DOCS,
    sort: [
      { 'event.sequence': { order: 'asc', unmapped_type: 'long' } },
      { '@timestamp': { order: 'asc' } },
    ],
    track_total_hits: false,
    query: {
      bool: {
        filter: [
          { range: { '@timestamp': { gte: 'now-30d' } } },
          { term: { 'log.custom.story_id': DEFAULT_TRACE_STORY_ID } },
          { term: { 'trace.id': traceId } },
        ],
      },
    },
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((source): source is AnyDocument => Boolean(source));
}

function toTraceListItem(source: AnyDocument): AipmTraceListItem {
  const traceId = getTraceId(source);
  const serviceName = getServiceName(source);
  const inputTokens = getInputTokens(source);
  const outputTokens = getOutputTokens(source);
  const totalCost = getCost(source);
  const warning = getNodeWarning(source);
  const userRating = getUserRating(source);
  const evaluationLabel = getEvaluationLabel(source);
  const model = getModel(source);

  return {
    traceId,
    startedAt: getTimestampIso(source),
    storyId: getStoryId(source),
    storyLabel: getStoryLabel(source),
    workflowId: getWorkflowId(source),
    workflowName: getWorkflowName(source),
    sessionId: getSessionId(source),
    serviceName: serviceName ?? 'unknown-service',
    provider: getProvider(source),
    model,
    outcome: getOutcome(source),
    durationUs: getDurationUs(source),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    totalCost,
    evaluationScore: getEvaluationScore(source),
    evaluationLabel,
    userRating,
    promptPreview: previewText(getPromptText(source)),
    answerPreview: previewText(getAnswerText(source)),
    warning,
    badges: asBadgeList([
      readString(source, ['attributes.es_sdk.variant.id']),
      model,
      formatRating(userRating),
      evaluationLabel,
      warning ? 'warning' : undefined,
    ]),
    apmQuery: buildApmQuery(serviceName, traceId),
  };
}

function buildEntityCounts(
  rootDocs: AnyDocument[],
  traceDocs: AnyDocument[]
): AipmTraceEntityCounts {
  return {
    traces: rootDocs.length,
    workflows: uniqueCount(rootDocs.map(getWorkflowId)),
    sessions: uniqueCount(rootDocs.map(getSessionId)),
    services: uniqueCount(traceDocs.map(getServiceName)),
    models: uniqueCount(traceDocs.map(getModel)),
    tools: uniqueCount(traceDocs.map(getToolName)),
    mcpServers: uniqueCount(traceDocs.map(getMcpServerName)),
  };
}

function buildTraceSummary(root: AnyDocument): AipmTraceSummary {
  const traceId = getTraceId(root);
  const serviceName = getServiceName(root);
  const inputTokens = getInputTokens(root);
  const outputTokens = getOutputTokens(root);

  return {
    traceId,
    storyId: getStoryId(root),
    storyLabel: getStoryLabel(root),
    workflowId: getWorkflowId(root),
    workflowName: getWorkflowName(root),
    sessionId: getSessionId(root),
    serviceName: serviceName ?? 'unknown-service',
    provider: getProvider(root),
    model: getModel(root),
    outcome: getOutcome(root),
    startedAt: getTimestampIso(root),
    durationUs: getDurationUs(root),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    totalCost: getCost(root),
    evaluationScore: getEvaluationScore(root),
    evaluationLabel: getEvaluationLabel(root),
    userRating: getUserRating(root),
    promptText: getPromptText(root),
    answerText: getAnswerText(root),
    warning: getNodeWarning(root),
    apmQuery: buildApmQuery(serviceName, traceId),
    badges: asBadgeList([
      readString(root, ['attributes.es_sdk.variant.id']),
      getModel(root),
      formatRating(getUserRating(root)),
      getEvaluationLabel(root),
      getNodeWarning(root) ? 'warning' : undefined,
    ]),
  };
}

function buildWaterfall(traceDocs: AnyDocument[], traceId: string): AipmTraceWaterfallItem[] {
  const root = traceDocs.find((doc) => !getParentSpanId(doc)) ?? traceDocs[0];
  const rootStartedAtUs = root ? getTimestampUs(root) : 0;
  const spanIdToDepth = new Map<string, number>();
  const spanIdToDoc = new Map<string, AnyDocument>();

  for (const doc of traceDocs) {
    const spanId = getSpanId(doc);
    if (spanId) {
      spanIdToDoc.set(spanId, doc);
    }
  }

  const getDepth = (doc: AnyDocument): number => {
    const spanId = getSpanId(doc);
    if (!spanId) {
      return 0;
    }

    const cached = spanIdToDepth.get(spanId);
    if (cached !== undefined) {
      return cached;
    }

    const parentSpanId = getParentSpanId(doc);
    if (!parentSpanId) {
      spanIdToDepth.set(spanId, 0);
      return 0;
    }

    const parent = spanIdToDoc.get(parentSpanId);
    const depth = parent ? getDepth(parent) + 1 : 0;
    spanIdToDepth.set(spanId, depth);
    return depth;
  };

  return traceDocs.map((doc) => {
    const traceServiceName = getServiceName(doc);
    const inputTokens = getInputTokens(doc);
    const outputTokens = getOutputTokens(doc);
    const cost = getCost(doc);

    return {
      id: getSpanId(doc) ?? getStepId(doc) ?? `${getTimestampUs(doc)}`,
      parentId: getParentSpanId(doc),
      stepId: getStepId(doc),
      parentStepId: getParentStepId(doc),
      label: getWorkflowName(doc),
      serviceName: traceServiceName ?? 'unknown-service',
      kind: readString(doc, ['kind']) ?? 'Internal',
      nodeKind: getNodeKind(doc),
      startedAt: getTimestampIso(doc),
      offsetUs: Math.max(0, getTimestampUs(doc) - rootStartedAtUs),
      durationUs: getDurationUs(doc),
      depth: getDepth(doc),
      outcome: getOutcome(doc),
      inputTokens: inputTokens > 0 ? inputTokens : undefined,
      outputTokens: outputTokens > 0 ? outputTokens : undefined,
      cost: cost > 0 ? cost : undefined,
      summary: getNodeSummary(doc),
      warning: getNodeWarning(doc),
      inputText: getPromptText(doc),
      outputText: getAnswerText(doc),
      badges: asBadgeList([
        getNodeLabel(doc) !== getWorkflowName(doc) ? getNodeLabel(doc) : undefined,
        getModel(doc),
        getToolName(doc),
        getMcpServerName(doc),
      ]),
      apmQuery: buildApmQuery(traceServiceName, traceId),
    };
  });
}

function buildSessionEvents(logDocs: AnyDocument[]): AipmTraceSessionEvent[] {
  return logDocs.map((doc, index) => {
    const level = readString(doc, ['log.level']) ?? 'info';
    const outcome = readString(doc, ['event.outcome']) ?? 'unknown';
    const message = readString(doc, ['message']) ?? 'Session event';
    const feedbackRating = readString(doc, ['log.custom.feedback_rating']);
    const evaluationLabel = readString(doc, ['log.custom.evaluation_label']);

    return {
      id: `${readString(doc, ['event.action']) ?? 'event'}-${index}`,
      timestamp: getTimestampIso(doc),
      sequence: Math.round(readNumber(doc, ['event.sequence']) ?? index),
      action: readString(doc, ['event.action']) ?? 'event',
      outcome,
      level,
      message,
      summary: readString(doc, ['log.custom.feedback_comment']) ?? undefined,
      badges: asBadgeList([
        readString(doc, ['log.custom.variant_id']),
        evaluationLabel,
        formatRating(feedbackRating),
        outcome !== 'success' ? level : undefined,
      ]),
    };
  });
}

function buildMap(
  trace: AipmTraceSummary,
  waterfall: AipmTraceWaterfallItem[]
): { nodes: AipmTraceMapNode[]; edges: AipmTraceMapEdge[] } {
  const nodes: AipmTraceMapNode[] = [];
  const edges: AipmTraceMapEdge[] = [];
  const nodeIds = new Set<string>();

  const promptNodeId = 'prompt.user';
  const responseNodeId = 'assistant.response';

  const addNode = (node: AipmTraceMapNode) => {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  };

  addNode({
    id: promptNodeId,
    label: 'User prompt',
    subtitle: trace.sessionId,
    nodeKind: 'prompt',
    outcome: 'success',
    inputTokens: trace.inputTokens > 0 ? trace.inputTokens : undefined,
    summary: trace.promptText,
    badges: asBadgeList([trace.storyLabel]),
    apmQuery: trace.apmQuery,
  });

  const stepIdForSpanId = new Map<string, string>();
  for (const item of waterfall) {
    const nodeId = item.stepId ?? item.id;
    stepIdForSpanId.set(item.id, nodeId);

    addNode({
      id: nodeId,
      label: item.badges[0] ?? item.label,
      subtitle: item.serviceName,
      nodeKind: item.nodeKind,
      outcome: item.outcome,
      startedAt: item.startedAt,
      durationUs: item.durationUs,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      cost: item.cost,
      summary: item.summary,
      warning: item.warning,
      badges: asBadgeList([
        ...item.badges.filter((badge) => badge !== (item.badges[0] ?? undefined)),
        item.outcome !== 'success' ? item.outcome : undefined,
      ]),
      apmQuery: item.apmQuery,
    });
  }

  addNode({
    id: responseNodeId,
    label: 'Assistant response',
    subtitle: trace.model,
    nodeKind: 'response',
    outcome: trace.outcome,
    outputTokens: trace.outputTokens > 0 ? trace.outputTokens : undefined,
    summary: trace.answerText,
    warning: trace.warning,
    badges: asBadgeList([formatRating(trace.userRating), trace.evaluationLabel]),
    apmQuery: trace.apmQuery,
  });

  const rootNodeId = waterfall.find((item) => item.depth === 0)?.stepId ?? waterfall[0]?.stepId;
  if (rootNodeId) {
    edges.push({
      id: `${promptNodeId}->${rootNodeId}`,
      source: promptNodeId,
      target: rootNodeId,
      label: formatEdgeLabel({ inputTokens: trace.inputTokens }),
      inputTokens: trace.inputTokens > 0 ? trace.inputTokens : undefined,
      summary: previewText(trace.promptText, 160),
      apmQuery: trace.apmQuery,
    });
  }

  for (const item of waterfall) {
    const targetId = item.stepId ?? item.id;
    const sourceId =
      item.parentStepId ?? (item.parentId ? stepIdForSpanId.get(item.parentId) : undefined);

    if (!sourceId) {
      continue;
    }

    edges.push({
      id: `${sourceId}->${targetId}`,
      source: sourceId,
      target: targetId,
      label: formatEdgeLabel({
        durationUs: item.durationUs,
        inputTokens: item.inputTokens,
        outputTokens: item.outputTokens,
        cost: item.cost,
      }),
      durationUs: item.durationUs,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      cost: item.cost,
      outcome: item.outcome,
      summary: item.summary,
      apmQuery: item.apmQuery,
    });
  }

  const answerNodeId = waterfall.find((item) => item.stepId === 'model.answer')?.stepId;
  if (answerNodeId) {
    edges.push({
      id: `${answerNodeId}->${responseNodeId}`,
      source: answerNodeId,
      target: responseNodeId,
      label: formatEdgeLabel({
        durationUs: trace.durationUs,
        outputTokens: trace.outputTokens,
        cost: trace.totalCost,
      }),
      durationUs: trace.durationUs,
      outputTokens: trace.outputTokens > 0 ? trace.outputTokens : undefined,
      cost: trace.totalCost > 0 ? trace.totalCost : undefined,
      outcome: trace.outcome,
      summary: previewText(trace.answerText, 160),
      apmQuery: trace.apmQuery,
    });
  }

  return { nodes, edges };
}

export async function getAipmTraces(
  esClient: ElasticsearchClient
): Promise<AipmTraceListRouteResponse> {
  const [rootDocs, traceDocs] = await Promise.all([
    searchRootTraces(esClient),
    searchTraceDocs(esClient),
  ]);

  return {
    updatedAt: new Date().toISOString(),
    storyId: DEFAULT_TRACE_STORY_ID,
    storyLabel: DEFAULT_TRACE_STORY_LABEL,
    traces: rootDocs.map(toTraceListItem),
    entityCounts: buildEntityCounts(rootDocs, traceDocs),
  };
}

export async function getAipmTraceDetail(
  esClient: ElasticsearchClient,
  traceId: string
): Promise<AipmTraceDetailRouteResponse | undefined> {
  const [traceDocs, logDocs] = await Promise.all([
    searchTraceDetailDocs(esClient, traceId),
    searchTraceDetailLogs(esClient, traceId),
  ]);

  if (traceDocs.length === 0) {
    return undefined;
  }

  const root = traceDocs.find((doc) => !getParentSpanId(doc)) ?? traceDocs[0];
  const trace = buildTraceSummary(root);
  const waterfall = buildWaterfall(traceDocs, traceId);
  const sessionEvents = buildSessionEvents(logDocs);
  const map = buildMap(trace, waterfall);

  return {
    updatedAt: new Date().toISOString(),
    trace,
    waterfall,
    sessionEvents,
    map,
  };
}
