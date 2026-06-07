/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  AipmDataRole,
  AipmFeatureDescriptor,
  AipmSourceTier,
  AipmShowcasePriority,
  AipmShowcaseTheme,
} from '@kbn/aipm-schema-catalog';

export const PLUGIN_ID = 'aipm';
export const PLUGIN_NAME = 'AI Observability';
export const PLAYGROUND_SURFACE_LABEL = 'Playground';
export const EXPERIMENTS_ARTIFACT_LABEL = 'Experiments';
export const AIPM_BOOTSTRAP_API_PATH = '/internal/observability/aipm/bootstrap';
export const AIPM_FEATURE_OVERVIEW_API_PATH = '/internal/observability/aipm/feature_overview';
export const AIPM_CURATED_TRACES_API_PATH = '/internal/observability/aipm/curated_traces';
export const getAipmCuratedTraceDetailApiPath = (traceId: string) =>
  `/internal/observability/aipm/curated_traces/${encodeURIComponent(traceId)}`;

export interface AipmBootstrapRouteResponse {
  pluginId: string;
  pluginName: string;
  schemaPackage: string;
  firstSurface: string;
  firstSavedArtifact: string;
  sourceTiers: AipmSourceTier[];
  dataRoles: AipmDataRole[];
  initialFeature: AipmFeatureDescriptor;
  featureCatalog: AipmFeatureDescriptor[];
}

export interface AipmFeatureMetric {
  label: string;
  value: string;
  color?: 'success' | 'warning' | 'danger' | 'subdued' | 'accent';
}

export interface AipmFeatureSampleRow {
  title: string;
  subtitle?: string;
  description?: string;
  badges?: string[];
}

export interface AipmFeatureOverview {
  id: string;
  title: string;
  showcaseTheme: AipmShowcaseTheme;
  showcasePriority: AipmShowcasePriority;
  summary: string;
  storyIds: string[];
  metrics: AipmFeatureMetric[];
  sampleRows: AipmFeatureSampleRow[];
  apmQuery?: string;
}

export interface AipmFeatureOverviewRouteResponse {
  updatedAt: string;
  features: AipmFeatureOverview[];
}

export interface AipmCuratedTraceListItem {
  traceId: string;
  startedAt: string;
  storyId: string;
  storyLabel: string;
  workflowId: string;
  workflowName: string;
  sessionId: string;
  serviceName: string;
  provider?: string;
  model?: string;
  outcome: string;
  durationUs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  evaluationScore?: number;
  evaluationLabel?: string;
  userRating?: string;
  promptPreview?: string;
  answerPreview?: string;
  warning?: string;
  badges: string[];
  apmQuery: string;
}

export interface AipmCuratedEntityCounts {
  traces: number;
  workflows: number;
  sessions: number;
  services: number;
  models: number;
  tools: number;
  mcpServers: number;
}

export interface AipmCuratedTraceListRouteResponse {
  updatedAt: string;
  storyId: string;
  storyLabel: string;
  traces: AipmCuratedTraceListItem[];
  entityCounts: AipmCuratedEntityCounts;
}

export interface AipmCuratedTraceSummary {
  traceId: string;
  storyId: string;
  storyLabel: string;
  workflowId: string;
  workflowName: string;
  sessionId: string;
  serviceName: string;
  provider?: string;
  model?: string;
  outcome: string;
  startedAt: string;
  durationUs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  evaluationScore?: number;
  evaluationLabel?: string;
  userRating?: string;
  promptText?: string;
  answerText?: string;
  warning?: string;
  apmQuery: string;
  badges: string[];
}

export interface AipmCuratedWaterfallItem {
  id: string;
  parentId?: string;
  stepId?: string;
  parentStepId?: string;
  label: string;
  serviceName: string;
  kind: string;
  nodeKind: string;
  startedAt: string;
  offsetUs: number;
  durationUs: number;
  depth: number;
  outcome: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  summary?: string;
  warning?: string;
  inputText?: string;
  outputText?: string;
  badges: string[];
  apmQuery: string;
}

export interface AipmCuratedSessionEvent {
  id: string;
  timestamp: string;
  sequence: number;
  action: string;
  outcome: string;
  level: string;
  message: string;
  summary?: string;
  badges: string[];
}

export interface AipmCuratedMapNode {
  id: string;
  label: string;
  subtitle?: string;
  nodeKind: string;
  outcome: string;
  startedAt?: string;
  durationUs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  summary?: string;
  warning?: string;
  badges: string[];
  apmQuery: string;
}

export interface AipmCuratedMapEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  durationUs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  outcome?: string;
  summary?: string;
  apmQuery: string;
}

export interface AipmCuratedTraceDetailRouteResponse {
  updatedAt: string;
  trace: AipmCuratedTraceSummary;
  waterfall: AipmCuratedWaterfallItem[];
  sessionEvents: AipmCuratedSessionEvent[];
  map: {
    nodes: AipmCuratedMapNode[];
    edges: AipmCuratedMapEdge[];
  };
}
