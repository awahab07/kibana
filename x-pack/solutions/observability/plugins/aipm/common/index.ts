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
