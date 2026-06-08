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
export const AIPM_TRACES_API_PATH = '/internal/observability/aipm/traces';
export const getAipmTraceDetailApiPath = (traceId: string) =>
  `/internal/observability/aipm/traces/${encodeURIComponent(traceId)}`;

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

export interface AipmTraceListItem {
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

export interface AipmTraceEntityCounts {
  traces: number;
  workflows: number;
  sessions: number;
  services: number;
  models: number;
  tools: number;
  mcpServers: number;
}

export interface AipmTraceListRouteResponse {
  updatedAt: string;
  storyId: string;
  storyLabel: string;
  traces: AipmTraceListItem[];
  entityCounts: AipmTraceEntityCounts;
}

export interface AipmTraceSummary {
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

export interface AipmTraceWaterfallItem {
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

export interface AipmTraceSessionEvent {
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

export interface AipmTraceMapNode {
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

export interface AipmTraceMapEdge {
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

export interface AipmTraceDetailRouteResponse {
  updatedAt: string;
  trace: AipmTraceSummary;
  waterfall: AipmTraceWaterfallItem[];
  sessionEvents: AipmTraceSessionEvent[];
  map: {
    nodes: AipmTraceMapNode[];
    edges: AipmTraceMapEdge[];
  };
}
