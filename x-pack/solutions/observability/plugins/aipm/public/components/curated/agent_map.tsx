/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EuiLink, EuiPanel, EuiSpacer, EuiText, EuiTitle, useEuiTheme } from '@elastic/eui';
import type { AipmCuratedMapEdge, AipmCuratedMapNode } from '../../../common';
import { applyGraphLayout } from './layout_graph';
import {
  AipmAgentMapEdge,
  type AipmAgentMapEdgeType,
  type AipmMapEdgeData,
} from './agent_map_edge';
import {
  AipmAgentMapNode,
  type AipmAgentMapNodeType,
  type AipmMapNodeData,
} from './agent_map_node';
import { formatCurrency, formatDurationUs, getNodeKindColor } from './formatters';

const nodeTypes: NodeTypes = {
  aipmNode: AipmAgentMapNode,
};

const edgeTypes: EdgeTypes = {
  aipmEdge: AipmAgentMapEdge,
};

function AipmAgentMapInner({
  nodes,
  edges,
  buildApmHref,
}: {
  nodes: AipmCuratedMapNode[];
  edges: AipmCuratedMapEdge[];
  buildApmHref: (apmQuery: string) => string;
}) {
  const { euiTheme } = useEuiTheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const flowNodes = useMemo<AipmAgentMapNodeType[]>(() => {
    const unsortedNodes: AipmAgentMapNodeType[] = nodes.map((node) => ({
      id: node.id,
      type: 'aipmNode' as const,
      data: node as AipmMapNodeData,
      position: { x: 0, y: 0 },
    }));

    const flowEdges: AipmAgentMapEdgeType[] = edges.map((edge) => ({
      id: edge.id,
      type: 'aipmEdge',
      source: edge.source,
      target: edge.target,
      data: edge as AipmMapEdgeData,
    }));

    return applyGraphLayout(unsortedNodes, flowEdges);
  }, [nodes, edges]);

  const flowEdges = useMemo<AipmAgentMapEdgeType[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        type: 'aipmEdge' as const,
        source: edge.source,
        target: edge.target,
        data: edge as AipmMapEdgeData,
      })),
    [edges]
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  return (
    <>
      <div style={{ height: 680, borderRadius: euiTheme.border.radius.medium, overflow: 'hidden' }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_event, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_event, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
        >
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              const data = node.data as unknown as AipmMapNodeData;
              const color = getNodeKindColor(data.nodeKind, data.outcome);

              return color === 'danger'
                ? euiTheme.colors.danger
                : color === 'warning'
                ? euiTheme.colors.warning
                : color === 'success'
                ? euiTheme.colors.success
                : color === 'accent'
                ? euiTheme.colors.accent
                : euiTheme.colors.primary;
            }}
          />
          <Background gap={18} color={euiTheme.colors.lightShade} />
        </ReactFlow>
      </div>

      <EuiSpacer size="m" />

      {selectedNode ? (
        <EuiPanel hasBorder hasShadow={false} color="subdued">
          <EuiTitle size="xs">
            <h3>{selectedNode.label}</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s">
            <p>{selectedNode.summary ?? 'No additional summary recorded.'}</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiText size="xs" color="subdued">
            <p>
              {selectedNode.subtitle ?? selectedNode.nodeKind} •{' '}
              {formatDurationUs(selectedNode.durationUs)}
              {selectedNode.cost ? ` • ${formatCurrency(selectedNode.cost)}` : ''}
            </p>
          </EuiText>
          {selectedNode.warning ? (
            <>
              <EuiSpacer size="s" />
              <EuiText size="xs" color="warning">
                <p>{selectedNode.warning}</p>
              </EuiText>
            </>
          ) : null}
          <EuiSpacer size="s" />
          <EuiLink
            href={buildApmHref(selectedNode.apmQuery)}
            data-test-subj="aipmAgentMapNodeOpenInApmLink"
          >
            Open selected node in APM
          </EuiLink>
        </EuiPanel>
      ) : null}

      {selectedEdge ? (
        <EuiPanel hasBorder hasShadow={false} color="subdued">
          <EuiTitle size="xs">
            <h3>Selected edge</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s">
            <p>{selectedEdge.summary ?? selectedEdge.label}</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiText size="xs" color="subdued">
            <p>
              {selectedEdge.label}
              {selectedEdge.cost ? ` • ${formatCurrency(selectedEdge.cost)}` : ''}
            </p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiLink
            href={buildApmHref(selectedEdge.apmQuery)}
            data-test-subj="aipmAgentMapEdgeOpenInApmLink"
          >
            Open edge context in APM
          </EuiLink>
        </EuiPanel>
      ) : null}
    </>
  );
}

export function AipmAgentMap({
  nodes,
  edges,
  buildApmHref,
}: {
  nodes: AipmCuratedMapNode[];
  edges: AipmCuratedMapEdge[];
  buildApmHref: (apmQuery: string) => string;
}) {
  return (
    <ReactFlowProvider>
      <AipmAgentMapInner nodes={nodes} edges={edges} buildApmHref={buildApmHref} />
    </ReactFlowProvider>
  );
}
