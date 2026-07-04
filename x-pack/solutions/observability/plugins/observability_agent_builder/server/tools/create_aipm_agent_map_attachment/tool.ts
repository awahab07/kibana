/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createHash } from 'crypto';
import { z } from '@kbn/zod/v4';
import type { Logger } from '@kbn/core/server';
import { ToolType } from '@kbn/agent-builder-common';
import { ToolResultType } from '@kbn/agent-builder-common/tools/tool_result';
import { renderAttachmentElement } from '@kbn/agent-builder-common/tools/custom_rendering';
import type { BuiltinToolDefinition, StaticToolRegistration } from '@kbn/agent-builder-server';
import { getToolResultId } from '@kbn/agent-builder-server';
import { getAipmTraceDetail } from '@kbn/aipm-plugin/server/lib/get_trace_experience';
import {
  OBSERVABILITY_AIPM_AGENT_MAP_ATTACHMENT_TYPE_ID,
  type ObservabilityAipmAgentMapAttachmentData,
} from '../../../common';
import type { ObservabilityAgentBuilderCoreSetup } from '../../types';
import { getAgentBuilderResourceAvailability } from '../../utils/get_agent_builder_resource_availability';

export const OBSERVABILITY_CREATE_AIPM_AGENT_MAP_ATTACHMENT_TOOL_ID =
  'observability.create_aipm_agent_map_attachment';

const createAipmAgentMapAttachmentSchema = z.object({
  traceId: z
    .string()
    .min(1)
    .describe(
      'The APM trace.id for the LLM transaction or APM transaction whose AIPM agent map should be rendered.'
    ),
  attachmentLabel: z.string().optional().describe('Optional label for the rendered chat card.'),
});

function buildAipmAgentMapAttachmentId(traceId: string) {
  const hash = createHash('sha256').update(traceId).digest('hex');
  return `observability.aipm.agentmap:${hash}`;
}

function buildRenderAttachmentTag({
  attachmentId,
  version,
}: {
  attachmentId: string;
  version: number;
}) {
  const { tagName } = renderAttachmentElement;
  const { attachmentId: idAttr, version: versionAttr } = renderAttachmentElement.attributes;
  return `<${tagName} ${idAttr}="${attachmentId}" ${versionAttr}="${version}" />`;
}

export function createAipmAgentMapAttachmentTool({
  core,
  logger,
}: {
  core: ObservabilityAgentBuilderCoreSetup;
  logger: Logger;
}): StaticToolRegistration<typeof createAipmAgentMapAttachmentSchema> {
  const toolDefinition: BuiltinToolDefinition<typeof createAipmAgentMapAttachmentSchema> = {
    id: OBSERVABILITY_CREATE_AIPM_AGENT_MAP_ATTACHMENT_TOOL_ID,
    type: ToolType.builtin,
    description: `Create and render an AIPM agent map attachment for a specific APM trace.id.

Use this when the user asks to trace, visualize, explain, or diagnose the LLM transaction, agent flow, tool path, MCP hops, downstream service calls, judge score, or feedback associated with a particular APM transaction or trace. If the user starts from an APM transaction, first identify its trace.id, then call this tool with that traceId.

The tool persists an observability.aipm_agent_map attachment and returns a renderTag. Include that renderTag verbatim in the final answer so the chat renders the embedded agent map.`,
    schema: createAipmAgentMapAttachmentSchema,
    tags: ['observability', 'aipm', 'llm', 'trace', 'agent-map', 'attachment'],
    availability: {
      cacheMode: 'space',
      handler: async ({ request }) => {
        return getAgentBuilderResourceAvailability({ core, request, logger });
      },
    },
    handler: async ({ traceId, attachmentLabel }, { esClient, attachments }) => {
      try {
        const detail = await getAipmTraceDetail(esClient.asCurrentUser, traceId);

        if (!detail) {
          return {
            results: [
              {
                tool_result_id: getToolResultId(),
                type: ToolResultType.error,
                data: {
                  message: `No AIPM trace detail found for trace.id ${traceId}.`,
                },
              },
            ],
          };
        }

        const data: ObservabilityAipmAgentMapAttachmentData = {
          attachmentLabel:
            attachmentLabel ??
            `AIPM agent map: ${detail.trace.workflowName || detail.trace.traceId}`,
          traceId: detail.trace.traceId,
          startedAt: detail.trace.startedAt,
          workflowName: detail.trace.workflowName,
          serviceName: detail.trace.serviceName,
          trace: detail.trace,
          map: detail.map,
        };
        const id = buildAipmAgentMapAttachmentId(detail.trace.traceId);
        const description = `AIPM agent map for trace ${detail.trace.traceId}`;

        const existing = attachments.getAttachmentRecord(id);
        const attachment = existing
          ? await attachments.update(id, { data, description })
          : await attachments.add({
              id,
              type: OBSERVABILITY_AIPM_AGENT_MAP_ATTACHMENT_TYPE_ID,
              data,
              description,
            });

        if (!attachment) {
          return {
            results: [
              {
                tool_result_id: getToolResultId(),
                type: ToolResultType.error,
                data: {
                  message: `Could not create AIPM agent map attachment for trace.id ${traceId}.`,
                },
              },
            ],
          };
        }

        return {
          results: [
            {
              tool_result_id: getToolResultId(),
              type: ToolResultType.other,
              data: {
                attachmentId: attachment.id,
                type: attachment.type,
                version: attachment.current_version,
                renderTag: buildRenderAttachmentTag({
                  attachmentId: attachment.id,
                  version: attachment.current_version,
                }),
                traceId: detail.trace.traceId,
                nodeCount: detail.map.nodes.length,
                edgeCount: detail.map.edges.length,
                apmQuery: detail.trace.apmQuery,
              },
            },
          ],
        };
      } catch (error) {
        logger.error(`Error creating AIPM agent map attachment: ${error.message}`);
        logger.debug(error);

        return {
          results: [
            {
              tool_result_id: getToolResultId(),
              type: ToolResultType.error,
              data: {
                message: `Failed to create AIPM agent map attachment: ${error.message}`,
                stack: error.stack,
              },
            },
          ],
        };
      }
    },
  };

  return toolDefinition;
}
