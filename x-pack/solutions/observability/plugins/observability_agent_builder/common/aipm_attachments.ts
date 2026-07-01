/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';

export const aipmTraceSummarySchema = z.object({
  traceId: z.string(),
  storyId: z.string(),
  storyLabel: z.string(),
  workflowId: z.string(),
  workflowName: z.string(),
  sessionId: z.string(),
  serviceName: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  outcome: z.string(),
  startedAt: z.string(),
  durationUs: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
  totalCost: z.number(),
  evaluationScore: z.number().optional(),
  evaluationLabel: z.string().optional(),
  userRating: z.string().optional(),
  promptText: z.string().optional(),
  answerText: z.string().optional(),
  warning: z.string().optional(),
  apmQuery: z.string(),
  badges: z.array(z.string()),
});

export const aipmTraceMapNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  subtitle: z.string().optional(),
  nodeKind: z.string(),
  outcome: z.string(),
  startedAt: z.string().optional(),
  durationUs: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cost: z.number().optional(),
  summary: z.string().optional(),
  warning: z.string().optional(),
  badges: z.array(z.string()),
  apmQuery: z.string(),
});

export const aipmTraceMapEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  durationUs: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cost: z.number().optional(),
  outcome: z.string().optional(),
  summary: z.string().optional(),
  apmQuery: z.string(),
});

export const aipmAgentMapAttachmentDataSchema = z.object({
  attachmentLabel: z.string().optional(),
  traceId: z.string(),
  startedAt: z.string(),
  workflowName: z.string(),
  serviceName: z.string(),
  trace: aipmTraceSummarySchema,
  map: z.object({
    nodes: z.array(aipmTraceMapNodeSchema),
    edges: z.array(aipmTraceMapEdgeSchema),
  }),
});

export type ObservabilityAipmAgentMapAttachmentData = z.infer<
  typeof aipmAgentMapAttachmentDataSchema
>;
