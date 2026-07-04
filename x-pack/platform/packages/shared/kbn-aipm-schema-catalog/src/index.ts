/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';

export const AIPM_SCHEMA_CATALOG_PACKAGE_NAME = '@kbn/aipm-schema-catalog';

export const AIPM_SOURCE_TIER_VALUES = ['otel', 'enriched_otel', 'sdk_enriched'] as const;
export const AIPM_DATA_ROLE_VALUES = ['runtime', 'integration', 'evaluation'] as const;
export const AIPM_CANONICAL_TREATMENT_VALUES = [
  'semconv_native',
  'normalize_to_semconv',
  'prefixed_enrichment_only',
] as const;
export const AIPM_SOURCE_CLASS_VALUES = [
  'semconv_native',
  'integration_enrichment',
  'sdk_enrichment',
] as const;
export const AIPM_STACK_LAYER_VALUES = [
  'l1_infrastructure',
  'l2_integration',
  'l3_orchestration',
  'l4_experience',
] as const;
export const AIPM_ENTERPRISE_RELEVANCE_VALUES = ['core', 'supporting', 'stretch'] as const;
export const AIPM_SHOWCASE_THEME_VALUES = [
  'investigate',
  'improve',
  'operate',
  'govern',
  'expand',
] as const;
export const AIPM_DELIVERY_ADAPTER_VALUES = ['app', 'dashboard', 'agent_builder', 'mcp'] as const;
export const AIPM_SHOWCASE_PRIORITY_VALUES = ['P0', 'P1', 'P2'] as const;

export const AipmSourceTierSchema = z.enum(AIPM_SOURCE_TIER_VALUES);
export const AipmDataRoleSchema = z.enum(AIPM_DATA_ROLE_VALUES);
export const AipmCanonicalTreatmentSchema = z.enum(AIPM_CANONICAL_TREATMENT_VALUES);
export const AipmSourceClassSchema = z.enum(AIPM_SOURCE_CLASS_VALUES);
export const AipmStackLayerSchema = z.enum(AIPM_STACK_LAYER_VALUES);
export const AipmEnterpriseRelevanceSchema = z.enum(AIPM_ENTERPRISE_RELEVANCE_VALUES);
export const AipmShowcaseThemeSchema = z.enum(AIPM_SHOWCASE_THEME_VALUES);
export const AipmDeliveryAdapterSchema = z.enum(AIPM_DELIVERY_ADAPTER_VALUES);
export const AipmShowcasePrioritySchema = z.enum(AIPM_SHOWCASE_PRIORITY_VALUES);

export const AipmFieldDescriptorSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sourceClass: AipmSourceClassSchema,
  minimumSourceTier: AipmSourceTierSchema,
  dataRole: AipmDataRoleSchema,
  canonicalTreatment: AipmCanonicalTreatmentSchema,
  ingestionPath: z.string().min(1),
  stackLayer: AipmStackLayerSchema,
  enterpriseRelevance: AipmEnterpriseRelevanceSchema,
  question: z.string().min(1),
  futureOtelName: z.string().min(1).optional(),
});

export const AipmFeatureDescriptorSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  minimumSourceTier: AipmSourceTierSchema,
  dataRoles: z.array(AipmDataRoleSchema).min(1),
  requiredFields: z.array(z.string().min(1)),
  ingestionPath: z.string().min(1),
  stackLayer: AipmStackLayerSchema,
  enterpriseRelevance: AipmEnterpriseRelevanceSchema,
  requiresCorrelation: z.boolean(),
  showcaseTheme: AipmShowcaseThemeSchema,
  showcasePriority: AipmShowcasePrioritySchema,
  storyIds: z.array(z.string().min(1)).min(1),
  deliveryAdapters: z.array(AipmDeliveryAdapterSchema).min(1),
});

export type AipmSourceTier = z.infer<typeof AipmSourceTierSchema>;
export type AipmDataRole = z.infer<typeof AipmDataRoleSchema>;
export type AipmCanonicalTreatment = z.infer<typeof AipmCanonicalTreatmentSchema>;
export type AipmSourceClass = z.infer<typeof AipmSourceClassSchema>;
export type AipmStackLayer = z.infer<typeof AipmStackLayerSchema>;
export type AipmEnterpriseRelevance = z.infer<typeof AipmEnterpriseRelevanceSchema>;
export type AipmShowcaseTheme = z.infer<typeof AipmShowcaseThemeSchema>;
export type AipmDeliveryAdapter = z.infer<typeof AipmDeliveryAdapterSchema>;
export type AipmShowcasePriority = z.infer<typeof AipmShowcasePrioritySchema>;
export type AipmFieldDescriptor = z.infer<typeof AipmFieldDescriptorSchema>;
export type AipmFeatureDescriptor = z.infer<typeof AipmFeatureDescriptorSchema>;

const defaultDeliveryAdapters: AipmDeliveryAdapter[] = ['app', 'dashboard', 'agent_builder', 'mcp'];

export const AIPM_PLAYGROUND_FEATURE_DESCRIPTOR = AipmFeatureDescriptorSchema.parse({
  id: 'playground',
  title: 'Playground',
  description:
    'Interactive side-by-side comparison workspace for providers, models, prompts, and workflow variants.',
  minimumSourceTier: 'otel',
  dataRoles: ['runtime', 'integration', 'evaluation'],
  requiredFields: [
    'gen_ai.request.model',
    'gen_ai.response.model',
    'gen_ai.usage.input_tokens',
    'gen_ai.usage.output_tokens',
  ],
  ingestionPath: 'otlp_or_synthtrace',
  stackLayer: 'l3_orchestration',
  enterpriseRelevance: 'core',
  requiresCorrelation: false,
  showcaseTheme: 'improve',
  showcasePriority: 'P0',
  storyIds: ['aipm-playground-routing-cost'],
  deliveryAdapters: defaultDeliveryAdapters,
});

const createFeatureDescriptor = (descriptor: AipmFeatureDescriptor) =>
  AipmFeatureDescriptorSchema.parse(descriptor);

export const AIPM_TOP_FEATURE_DESCRIPTORS = [
  createFeatureDescriptor({
    id: 'trace_explorer',
    title: 'End-to-end trace explorer',
    description:
      'Investigate prompts, model calls, retrieval, tools, and outcomes across one workflow execution.',
    minimumSourceTier: 'otel',
    dataRoles: ['runtime', 'integration'],
    requiredFields: ['trace.id', 'span.id', 'parent.id', 'gen_ai.operation.name', 'event.outcome'],
    ingestionPath: 'otlp_or_synthtrace',
    stackLayer: 'l3_orchestration',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'investigate',
    showcasePriority: 'P0',
    storyIds: [
      'aipm-playground-routing-cost',
      'aipm-tool-retrieval-mcp-orchestration',
      'aipm-provider-runtime-schema-drift',
      'aipm-semantic-failures',
    ],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  AIPM_PLAYGROUND_FEATURE_DESCRIPTOR,
  createFeatureDescriptor({
    id: 'cross_signal_correlation',
    title: 'Cross-signal AI + APM correlation',
    description:
      'Connect AI traces to services, infrastructure, and rollout state for root-cause analysis.',
    minimumSourceTier: 'enriched_otel',
    dataRoles: ['runtime', 'integration'],
    requiredFields: [
      'service.name',
      'trace.id',
      'resource.attributes.host.name',
      'deployment.environment',
    ],
    ingestionPath: 'otlp_plus_metrics_and_logs',
    stackLayer: 'l2_integration',
    enterpriseRelevance: 'core',
    requiresCorrelation: true,
    showcaseTheme: 'investigate',
    showcasePriority: 'P0',
    storyIds: ['aipm-cross-signal-rollout-capacity'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'session_timeline',
    title: 'Session reconstruction',
    description:
      'Reconstruct ordered multi-turn timelines across logs and traces with session and conversation context.',
    minimumSourceTier: 'otel',
    dataRoles: ['runtime', 'integration'],
    requiredFields: ['session.id', 'event.sequence', 'gen_ai.conversation.id', '@timestamp'],
    ingestionPath: 'otlp_plus_logs_or_synthtrace',
    stackLayer: 'l4_experience',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'investigate',
    showcasePriority: 'P0',
    storyIds: ['aipm-session-reconstruction-audit'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'tool_retrieval_mcp',
    title: 'Tool, retrieval, and MCP breakdown',
    description:
      'Break down tool execution, retriever quality, and MCP fan-out or failures inside agent workflows.',
    minimumSourceTier: 'otel',
    dataRoles: ['runtime', 'integration', 'evaluation'],
    requiredFields: [
      'gen_ai.tool.name',
      'gen_ai.tool.call.id',
      'es_sdk.tool.arguments',
      'es_integ.retrieval.document_count',
      'es_integ.mcp.server_name',
    ],
    ingestionPath: 'otlp_or_synthtrace',
    stackLayer: 'l3_orchestration',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'investigate',
    showcasePriority: 'P0',
    storyIds: ['aipm-tool-retrieval-mcp-orchestration'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'quality_release_gates',
    title: 'Quality gates',
    description:
      'Track evaluator scores, review requirements, and release-gate decisions for prompts, models, and workflows.',
    minimumSourceTier: 'enriched_otel',
    dataRoles: ['evaluation', 'runtime'],
    requiredFields: [
      'es_sdk.evaluation.score',
      'es_sdk.evaluation.label',
      'es_sdk.release.gate',
      'es_sdk.prompt.version',
    ],
    ingestionPath: 'synthtrace_or_sdk_enriched',
    stackLayer: 'l4_experience',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'improve',
    showcasePriority: 'P0',
    storyIds: ['aipm-quality-eval-release-gating'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'cost_analytics',
    title: 'Cost and token analytics',
    description:
      'Compare token usage, spend, and provider or model efficiency across workflows and users.',
    minimumSourceTier: 'otel',
    dataRoles: ['runtime', 'integration'],
    requiredFields: [
      'gen_ai.usage.input_tokens',
      'gen_ai.usage.cached_input_tokens',
      'gen_ai.usage.output_tokens',
      'gen_ai.usage.cost',
    ],
    ingestionPath: 'otlp_or_synthtrace',
    stackLayer: 'l4_experience',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'operate',
    showcasePriority: 'P0',
    storyIds: [
      'aipm-playground-routing-cost',
      'aipm-cross-signal-rollout-capacity',
      'aipm-quality-eval-release-gating',
    ],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'reliability_monitoring',
    title: 'Latency, error, and reliability monitoring',
    description:
      'Monitor failures, duration, provider anomalies, and reliability regressions across AI workloads.',
    minimumSourceTier: 'otel',
    dataRoles: ['runtime', 'integration'],
    requiredFields: ['span.duration.us', 'transaction.duration.us', 'event.outcome', 'error.type'],
    ingestionPath: 'otlp_or_synthtrace',
    stackLayer: 'l2_integration',
    enterpriseRelevance: 'core',
    requiresCorrelation: true,
    showcaseTheme: 'operate',
    showcasePriority: 'P0',
    storyIds: ['aipm-provider-runtime-schema-drift', 'aipm-cross-signal-rollout-capacity'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'security_guardrails',
    title: 'Security and guardrails',
    description:
      'Surface prompt injection, unsafe tool targets, secret exposure, and guardrail outcomes.',
    minimumSourceTier: 'enriched_otel',
    dataRoles: ['runtime', 'integration', 'evaluation'],
    requiredFields: [
      'es_integ.guardrail.category',
      'es_integ.guardrail.blocked',
      'es_sdk.security.variant',
    ],
    ingestionPath: 'synthtrace_or_sdk_enriched',
    stackLayer: 'l4_experience',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'govern',
    showcasePriority: 'P0',
    storyIds: ['aipm-indirect-prompt-injection'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
  createFeatureDescriptor({
    id: 'experiments',
    title: 'Experiments and datasets',
    description:
      'Promote mutable Playground exploration into durable, comparable experiment and dataset artifacts.',
    minimumSourceTier: 'enriched_otel',
    dataRoles: ['evaluation', 'runtime'],
    requiredFields: ['es_sdk.experiment.id', 'es_sdk.dataset.id', 'es_sdk.prompt.version'],
    ingestionPath: 'synthtrace_or_sdk_enriched',
    stackLayer: 'l4_experience',
    enterpriseRelevance: 'core',
    requiresCorrelation: false,
    showcaseTheme: 'improve',
    showcasePriority: 'P0',
    storyIds: ['aipm-quality-eval-release-gating', 'aipm-playground-routing-cost'],
    deliveryAdapters: defaultDeliveryAdapters,
  }),
];

export const AIPM_FEATURE_DESCRIPTOR_BY_ID = Object.fromEntries(
  AIPM_TOP_FEATURE_DESCRIPTORS.map((feature) => [feature.id, feature])
) as Record<string, AipmFeatureDescriptor>;
