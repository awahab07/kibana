/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type { AipmFeatureDescriptor } from '@kbn/aipm-schema-catalog';
import { AIPM_TOP_FEATURE_DESCRIPTORS } from '@kbn/aipm-schema-catalog';
import type {
  AipmFeatureMetric,
  AipmFeatureOverview,
  AipmFeatureOverviewRouteResponse,
  AipmFeatureSampleRow,
} from '../../common';

const TRACE_INDEX_PATTERN = ['traces-apm*', 'traces-*.otel*'];
const LOG_INDEX_PATTERN = ['logs-*'];
const METRIC_INDEX_PATTERN = ['metrics-*'];
const MAX_TRACE_DOCS = 180;
const MAX_LOG_DOCS = 160;
const MAX_METRIC_DOCS = 120;

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

function readBoolean(source: AnyDocument, paths: string[]): boolean | undefined {
  for (const path of paths) {
    const value = readField(source, path);

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function buildStoryQuery(field: string, storyIds: string[]) {
  return storyIds.map((storyId) => `${field}:"${storyId}"`).join(' OR ');
}

async function searchRecentDocuments(
  esClient: ElasticsearchClient,
  index: string[],
  query: string,
  size: number
): Promise<AnyDocument[]> {
  const response = await esClient.search<AnyDocument>({
    index,
    size,
    sort: [{ '@timestamp': { order: 'desc' } }],
    track_total_hits: false,
    query: {
      bool: {
        filter: [
          {
            range: {
              '@timestamp': {
                gte: 'now-30d',
              },
            },
          },
          {
            query_string: {
              query,
            },
          },
        ],
      },
    },
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((source): source is AnyDocument => Boolean(source));
}

async function searchTraceDocuments(esClient: ElasticsearchClient, storyIds: string[]) {
  return searchRecentDocuments(
    esClient,
    TRACE_INDEX_PATTERN,
    buildStoryQuery('attributes.es_sdk.story.id', storyIds),
    MAX_TRACE_DOCS
  );
}

async function searchLogDocuments(esClient: ElasticsearchClient, storyIds: string[]) {
  return searchRecentDocuments(
    esClient,
    LOG_INDEX_PATTERN,
    buildStoryQuery('log.custom.story_id', storyIds),
    MAX_LOG_DOCS
  );
}

async function searchMetricDocuments(esClient: ElasticsearchClient, query: string) {
  return searchRecentDocuments(esClient, METRIC_INDEX_PATTERN, query, MAX_METRIC_DOCS);
}

function asBadgeList(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.length > 0));
}

function formatCurrency(value: number) {
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function uniqueCount(values: Array<string | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function buildMetric(
  label: string,
  value: string,
  color?: AipmFeatureMetric['color']
): AipmFeatureMetric {
  return {
    label,
    value,
    ...(color ? { color } : {}),
  };
}

function buildApmQuery(traceDocs: AnyDocument[]) {
  const serviceName = readString(traceDocs[0] ?? {}, [
    'service.name',
    'attributes.service.name',
    'resource.attributes.service.name',
  ]);

  return serviceName ? `service.name : "${serviceName}"` : undefined;
}

function buildTraceSampleRows(traceDocs: AnyDocument[]): AipmFeatureSampleRow[] {
  const rows = traceDocs.slice(0, 5).map((source) => {
    const workflowName =
      readString(source, ['transaction.name', 'span.name']) ?? 'Workflow execution';
    const serviceName = readString(source, [
      'service.name',
      'attributes.service.name',
      'resource.attributes.service.name',
    ]);
    const model = readString(source, [
      'attributes.gen_ai.response.model',
      'attributes.gen_ai.request.model',
    ]);
    const outcome = readString(source, ['event.outcome', 'attributes.event.outcome']) ?? 'unknown';
    const latencyUs =
      readNumber(source, ['transaction.duration.us', 'span.duration.us', 'event.duration']) ?? 0;

    return {
      title: workflowName,
      subtitle: serviceName,
      description: `${outcome} • ${formatDurationUs(latencyUs)}`,
      badges: asBadgeList([model, readString(source, ['attributes.es_sdk.variant.id'])]),
    };
  });

  return rows;
}

function buildLogSampleRows(logDocs: AnyDocument[]): AipmFeatureSampleRow[] {
  return logDocs.slice(0, 5).map((source) => ({
    title: readString(source, ['message']) ?? 'Session event',
    subtitle: readString(source, ['event.action']),
    description: readString(source, ['log.level']),
    badges: asBadgeList([
      readString(source, ['session.id']),
      readString(source, ['log.custom.variant_id']),
    ]),
  }));
}

function buildTraceExplorerOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[]
): AipmFeatureOverview {
  const outcomes = traceDocs.map(
    (source) => readString(source, ['event.outcome', 'attributes.event.outcome']) ?? 'unknown'
  );
  const latencyValues = traceDocs
    .map((source) =>
      readNumber(source, ['transaction.duration.us', 'span.duration.us', 'event.duration'])
    )
    .filter((value): value is number => value !== undefined);

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Trace explorer modules are panel-safe and surface the exact execution path, outcome, latency, and model context for recent workflow runs.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric('Trace docs', String(traceDocs.length)),
      buildMetric(
        'Failed runs',
        String(outcomes.filter((value) => value === 'failure').length),
        'danger'
      ),
      buildMetric(
        'Avg duration',
        latencyValues.length > 0 ? formatDurationUs(average(latencyValues)) : 'n/a'
      ),
      buildMetric(
        'Services',
        String(
          uniqueCount(
            traceDocs.map((source) =>
              readString(source, [
                'service.name',
                'attributes.service.name',
                'resource.attributes.service.name',
              ])
            )
          )
        )
      ),
    ],
    sampleRows: buildTraceSampleRows(traceDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildPlaygroundOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[]
): AipmFeatureOverview {
  const costs = traceDocs
    .map((source) => readNumber(source, ['attributes.gen_ai.usage.cost']))
    .filter((value): value is number => value !== undefined);
  const latencies = traceDocs
    .map((source) => readNumber(source, ['transaction.duration.us', 'span.duration.us']))
    .filter((value): value is number => value !== undefined);

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Playground panels compare prompt or model variants side by side and stay portable across the app, dashboards, Agent Builder, and MCP adapters.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric(
        'Variants',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.es_sdk.variant.id']))
          )
        )
      ),
      buildMetric('Avg cost', costs.length > 0 ? formatCurrency(average(costs)) : 'n/a'),
      buildMetric(
        'Avg latency',
        latencies.length > 0 ? formatDurationUs(average(latencies)) : 'n/a'
      ),
      buildMetric(
        'Models',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.gen_ai.response.model']))
          )
        )
      ),
    ],
    sampleRows: buildTraceSampleRows(traceDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildCrossSignalOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[],
  metricDocs: AnyDocument[]
): AipmFeatureOverview {
  const cpuValues = metricDocs
    .map((source) =>
      readNumber(source, ['system.cpu.utilization', 'metrics.system.cpu.utilization'])
    )
    .filter((value): value is number => value !== undefined);

  const sampleRows = metricDocs.slice(0, 5).map((source) => ({
    title:
      readString(source, ['host.name', 'host.hostname', 'resource.attributes.host.name']) ??
      'Infrastructure host',
    subtitle:
      readString(source, ['metricset.name', 'event.dataset', 'metricset.period']) ?? 'metrics',
    description:
      cpuValues.length > 0
        ? `CPU ${formatPercent(Math.max(...cpuValues))} during incident window`
        : 'Metric sample',
    badges: asBadgeList([
      readString(source, ['labels.channel']),
      readString(source, ['attributes.es_integ.rollout.channel']),
    ]),
  }));

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Cross-signal panels tie AI workflow regressions to host saturation, rollout state, and service inventory without leaving Observability.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric(
        'AI services',
        String(
          uniqueCount(
            traceDocs.map((source) =>
              readString(source, [
                'service.name',
                'attributes.service.name',
                'resource.attributes.service.name',
              ])
            )
          )
        )
      ),
      buildMetric(
        'Hosts',
        String(
          uniqueCount(
            metricDocs.map((source) =>
              readString(source, ['host.name', 'host.hostname', 'resource.attributes.host.name'])
            )
          )
        )
      ),
      buildMetric(
        'Peak CPU',
        cpuValues.length > 0 ? formatPercent(Math.max(...cpuValues)) : 'n/a',
        cpuValues.some((value) => value >= 0.9) ? 'warning' : 'success'
      ),
      buildMetric('Metric docs', String(metricDocs.length)),
    ],
    sampleRows,
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildSessionOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[],
  logDocs: AnyDocument[]
): AipmFeatureOverview {
  const eventSequences = logDocs
    .map((source) => readNumber(source, ['event.sequence']))
    .filter((value): value is number => value !== undefined);
  const redactedCount = traceDocs.filter((source) =>
    readBoolean(source, ['attributes.es_sdk.audit.redacted'])
  ).length;

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Session panels reconstruct ordered multi-turn histories from trace and log evidence, including redaction state and conversation identifiers.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric(
        'Sessions',
        String(uniqueCount(logDocs.map((source) => readString(source, ['session.id']))))
      ),
      buildMetric('Log events', String(logDocs.length)),
      buildMetric(
        'Redacted runs',
        String(redactedCount),
        redactedCount > 0 ? 'warning' : 'subdued'
      ),
      buildMetric(
        'Max sequence',
        eventSequences.length > 0 ? String(Math.max(...eventSequences)) : 'n/a'
      ),
    ],
    sampleRows: buildLogSampleRows(logDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildToolOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[],
  logDocs: AnyDocument[]
): AipmFeatureOverview {
  const toolErrors = traceDocs.filter(
    (source) =>
      readString(source, ['event.outcome', 'attributes.event.outcome']) === 'failure' &&
      Boolean(
        readString(source, ['attributes.es_sdk.tool.arguments', 'attributes.gen_ai.tool.name'])
      )
  ).length;

  const mcpRows = traceDocs.slice(0, 5).map((source) => ({
    title: readString(source, ['span.name', 'transaction.name']) ?? 'Tool step',
    subtitle:
      readString(source, ['attributes.gen_ai.tool.name', 'attributes.es_integ.mcp.server_name']) ??
      'orchestration step',
    description:
      readString(source, ['attributes.es_sdk.tool.arguments', 'error.type']) ??
      'Inspect arguments and errors',
    badges: asBadgeList([
      readString(source, ['attributes.es_sdk.variant.id']),
      readString(source, ['attributes.event.outcome']),
    ]),
  }));

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Tool and retrieval panels isolate argument misuse, fan-out, and retrieval quality issues behind one reusable investigation surface.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric(
        'Tool names',
        String(
          uniqueCount(
            traceDocs.map((source) =>
              readString(source, [
                'attributes.gen_ai.tool.name',
                'attributes.es_integ.mcp.server_name',
              ])
            )
          )
        )
      ),
      buildMetric('Tool failures', String(toolErrors), toolErrors > 0 ? 'danger' : 'success'),
      buildMetric(
        'Log actions',
        String(uniqueCount(logDocs.map((source) => readString(source, ['event.action']))))
      ),
      buildMetric('Trace docs', String(traceDocs.length)),
    ],
    sampleRows: mcpRows,
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildQualityOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[],
  logDocs: AnyDocument[]
): AipmFeatureOverview {
  const scores = traceDocs
    .map((source) => readNumber(source, ['attributes.es_sdk.evaluation.score']))
    .filter((value): value is number => value !== undefined);
  const holdCount = traceDocs.filter(
    (source) => readString(source, ['attributes.es_sdk.release.gate']) === 'hold'
  ).length;

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Quality panels combine evaluator scores, prompt versions, and release decisions so regressions stay visible before rollout.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric('Avg score', scores.length > 0 ? average(scores).toFixed(2) : 'n/a'),
      buildMetric('Held releases', String(holdCount), holdCount > 0 ? 'warning' : 'success'),
      buildMetric(
        'Prompt versions',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.es_sdk.prompt.version']))
          )
        )
      ),
      buildMetric('Evidence rows', String(logDocs.length)),
    ],
    sampleRows: buildLogSampleRows(logDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildCostOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[]
): AipmFeatureOverview {
  const costs = traceDocs
    .map((source) => readNumber(source, ['attributes.gen_ai.usage.cost']))
    .filter((value): value is number => value !== undefined);
  const inputTokens = traceDocs
    .map((source) => readNumber(source, ['attributes.gen_ai.usage.input_tokens']))
    .filter((value): value is number => value !== undefined);
  const outputTokens = traceDocs
    .map((source) => readNumber(source, ['attributes.gen_ai.usage.output_tokens']))
    .filter((value): value is number => value !== undefined);

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Cost panels break down spend and token pressure by workflow, provider, and variant using the same traces that drive investigations.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric('Total cost', costs.length > 0 ? formatCurrency(sum(costs)) : 'n/a'),
      buildMetric(
        'Input tokens',
        inputTokens.length > 0 ? String(Math.round(sum(inputTokens))) : 'n/a'
      ),
      buildMetric(
        'Output tokens',
        outputTokens.length > 0 ? String(Math.round(sum(outputTokens))) : 'n/a'
      ),
      buildMetric(
        'Organizations',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.es_sdk.organization.id']))
          )
        )
      ),
    ],
    sampleRows: buildTraceSampleRows(traceDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildReliabilityOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[]
): AipmFeatureOverview {
  const latencyValues = traceDocs
    .map((source) => readNumber(source, ['transaction.duration.us', 'span.duration.us']))
    .filter((value): value is number => value !== undefined);
  const failures = traceDocs.filter(
    (source) => readString(source, ['event.outcome', 'attributes.event.outcome']) === 'failure'
  ).length;

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Reliability panels surface latency bursts, provider failures, and error-heavy variants as embeddable operational monitors.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric('Failures', String(failures), failures > 0 ? 'danger' : 'success'),
      buildMetric(
        'Avg duration',
        latencyValues.length > 0 ? formatDurationUs(average(latencyValues)) : 'n/a'
      ),
      buildMetric(
        'Providers',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.gen_ai.provider.name']))
          )
        )
      ),
      buildMetric('Trace docs', String(traceDocs.length)),
    ],
    sampleRows: buildTraceSampleRows(traceDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildSecurityOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[],
  logDocs: AnyDocument[]
): AipmFeatureOverview {
  const blockedCount = traceDocs.filter((source) =>
    readBoolean(source, ['attributes.es_integ.guardrail.blocked'])
  ).length;

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Security panels highlight blocked injections, risky tool targets, and review-required runs from the same telemetry used for RCA.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric('Blocked runs', String(blockedCount), blockedCount > 0 ? 'warning' : 'success'),
      buildMetric(
        'Variants',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.es_sdk.security.variant']))
          )
        )
      ),
      buildMetric(
        'Categories',
        String(
          uniqueCount(
            traceDocs.map((source) =>
              readString(source, ['attributes.es_integ.guardrail.category'])
            )
          )
        )
      ),
      buildMetric('Audit events', String(logDocs.length)),
    ],
    sampleRows: buildLogSampleRows(logDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

function buildExperimentOverview(
  descriptor: AipmFeatureDescriptor,
  traceDocs: AnyDocument[],
  logDocs: AnyDocument[]
): AipmFeatureOverview {
  const promptVersions = uniqueCount(
    traceDocs.map((source) => readString(source, ['attributes.es_sdk.prompt.version']))
  );
  const experimentIds = uniqueCount(
    traceDocs.map((source) => readString(source, ['attributes.es_sdk.experiment.id']))
  );

  return {
    id: descriptor.id,
    title: descriptor.title,
    showcaseTheme: descriptor.showcaseTheme,
    showcasePriority: descriptor.showcasePriority,
    summary:
      'Experiment panels separate mutable Playground work from durable comparison artifacts while keeping evidence linked to runtime traces.',
    storyIds: [...descriptor.storyIds],
    metrics: [
      buildMetric('Experiment ids', String(experimentIds)),
      buildMetric('Prompt versions', String(promptVersions)),
      buildMetric(
        'Dataset ids',
        String(
          uniqueCount(
            traceDocs.map((source) => readString(source, ['attributes.es_sdk.dataset.id']))
          )
        )
      ),
      buildMetric(
        'Promotion events',
        String(
          logDocs.filter(
            (source) => readString(source, ['event.action']) === 'release.gate.updated'
          ).length
        )
      ),
    ],
    sampleRows: buildLogSampleRows(logDocs),
    apmQuery: buildApmQuery(traceDocs),
  };
}

async function buildFeatureOverview(
  esClient: ElasticsearchClient,
  descriptor: AipmFeatureDescriptor
): Promise<AipmFeatureOverview> {
  switch (descriptor.id) {
    case 'trace_explorer': {
      const traceDocs = await searchTraceDocuments(esClient, descriptor.storyIds);
      return buildTraceExplorerOverview(descriptor, traceDocs);
    }
    case 'playground': {
      const traceDocs = await searchTraceDocuments(esClient, descriptor.storyIds);
      return buildPlaygroundOverview(descriptor, traceDocs);
    }
    case 'cross_signal_correlation': {
      const [traceDocs, metricDocs] = await Promise.all([
        searchTraceDocuments(esClient, descriptor.storyIds),
        searchMetricDocuments(
          esClient,
          'host.name:"aipm-canary-node-1" OR host.hostname:"aipm-canary-node-1" OR resource.attributes.host.name:"aipm-canary-node-1"'
        ),
      ]);
      return buildCrossSignalOverview(descriptor, traceDocs, metricDocs);
    }
    case 'session_timeline': {
      const [traceDocs, logDocs] = await Promise.all([
        searchTraceDocuments(esClient, descriptor.storyIds),
        searchLogDocuments(esClient, descriptor.storyIds),
      ]);
      return buildSessionOverview(descriptor, traceDocs, logDocs);
    }
    case 'tool_retrieval_mcp': {
      const [traceDocs, logDocs] = await Promise.all([
        searchTraceDocuments(esClient, descriptor.storyIds),
        searchLogDocuments(esClient, descriptor.storyIds),
      ]);
      return buildToolOverview(descriptor, traceDocs, logDocs);
    }
    case 'quality_release_gates': {
      const [traceDocs, logDocs] = await Promise.all([
        searchTraceDocuments(esClient, descriptor.storyIds),
        searchLogDocuments(esClient, descriptor.storyIds),
      ]);
      return buildQualityOverview(descriptor, traceDocs, logDocs);
    }
    case 'cost_analytics': {
      const traceDocs = await searchTraceDocuments(esClient, descriptor.storyIds);
      return buildCostOverview(descriptor, traceDocs);
    }
    case 'reliability_monitoring': {
      const traceDocs = await searchTraceDocuments(esClient, descriptor.storyIds);
      return buildReliabilityOverview(descriptor, traceDocs);
    }
    case 'security_guardrails': {
      const [traceDocs, logDocs] = await Promise.all([
        searchTraceDocuments(esClient, descriptor.storyIds),
        searchLogDocuments(esClient, descriptor.storyIds),
      ]);
      return buildSecurityOverview(descriptor, traceDocs, logDocs);
    }
    case 'experiments': {
      const [traceDocs, logDocs] = await Promise.all([
        searchTraceDocuments(esClient, descriptor.storyIds),
        searchLogDocuments(esClient, descriptor.storyIds),
      ]);
      return buildExperimentOverview(descriptor, traceDocs, logDocs);
    }
    default:
      return {
        id: descriptor.id,
        title: descriptor.title,
        showcaseTheme: descriptor.showcaseTheme,
        showcasePriority: descriptor.showcasePriority,
        summary: descriptor.description,
        storyIds: [...descriptor.storyIds],
        metrics: [],
        sampleRows: [],
      };
  }
}

export async function getAipmFeatureOverview(
  esClient: ElasticsearchClient
): Promise<AipmFeatureOverviewRouteResponse> {
  const features = await Promise.all(
    AIPM_TOP_FEATURE_DESCRIPTORS.map((descriptor: AipmFeatureDescriptor) =>
      buildFeatureOverview(esClient, descriptor)
    )
  );

  return {
    updatedAt: new Date().toISOString(),
    features,
  };
}
