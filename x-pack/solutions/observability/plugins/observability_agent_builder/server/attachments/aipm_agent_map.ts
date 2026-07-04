/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import dedent from 'dedent';
import type { AttachmentTypeDefinition } from '@kbn/agent-builder-server/attachments';
import {
  aipmAgentMapAttachmentDataSchema,
  OBSERVABILITY_AIPM_AGENT_MAP_ATTACHMENT_TYPE_ID,
  type ObservabilityAipmAgentMapAttachmentData,
} from '../../common';

export function createAipmAgentMapAttachmentType(): AttachmentTypeDefinition<
  typeof OBSERVABILITY_AIPM_AGENT_MAP_ATTACHMENT_TYPE_ID,
  ObservabilityAipmAgentMapAttachmentData
> {
  return {
    id: OBSERVABILITY_AIPM_AGENT_MAP_ATTACHMENT_TYPE_ID,
    validate: (input) => {
      const parsed = aipmAgentMapAttachmentDataSchema.safeParse(input);
      if (!parsed.success) {
        return { valid: false, error: parsed.error.message };
      }
      if (parsed.data.map.nodes.length === 0) {
        return { valid: false, error: 'AIPM agent map has no nodes to display.' };
      }
      if (parsed.data.map.edges.length === 0) {
        return { valid: false, error: 'AIPM agent map has no edges to display.' };
      }
      return { valid: true, data: parsed.data };
    },
    format: (attachment) => {
      const { trace, map } = attachment.data;
      return {
        getRepresentation: () => ({
          type: 'text',
          value: dedent(`
            AIPM agent map for trace ${trace.traceId}
            Workflow: ${trace.workflowName}
            Service: ${trace.serviceName}
            Nodes: ${map.nodes.map((node) => `${node.label} (${node.nodeKind})`).join(', ')}
            Edges: ${map.edges.map((edge) => `${edge.source} -> ${edge.target}`).join(', ')}
          `),
        }),
      };
    },
    getTools: () => [],
    getAgentDescription: () =>
      'An AIPM agent map attachment that renders a single LLM transaction as a topology of prompt, agent, model, tool, MCP, downstream APM services, evaluation, feedback, and response nodes.',
  };
}
