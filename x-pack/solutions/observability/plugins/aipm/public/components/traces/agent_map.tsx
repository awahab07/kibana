/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EuiLink, EuiPanel, EuiSpacer, EuiText, EuiTitle, useEuiTheme } from '@elastic/eui';
import type { AipmTraceMapEdge, AipmTraceMapNode } from '../../../common';
import {
  AIPM_AGENT_MAP_NODE_HEIGHT,
  AIPM_AGENT_MAP_NODE_WIDTH,
  applyGraphLayout,
} from './layout_graph';
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
  height,
  showMiniMap,
  focusedNodeId,
  focusedEdgeId,
}: {
  nodes: AipmTraceMapNode[];
  edges: AipmTraceMapEdge[];
  buildApmHref: (apmQuery: string) => string;
  height: number;
  showMiniMap: boolean;
  focusedNodeId?: string;
  focusedEdgeId?: string;
}) {
  const { euiTheme } = useEuiTheme();
  const { setCenter } = useReactFlow();
  const initialFocusedNodeId =
    focusedNodeId && nodes.some((node) => node.id === focusedNodeId) ? focusedNodeId : undefined;
  const initialFocusedEdgeId =
    !initialFocusedNodeId && focusedEdgeId && edges.some((edge) => edge.id === focusedEdgeId)
      ? focusedEdgeId
      : undefined;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialFocusedNodeId ?? (initialFocusedEdgeId ? null : nodes[0]?.id ?? null)
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(initialFocusedEdgeId ?? null);

  const flowNodes = useMemo<AipmAgentMapNodeType[]>(() => {
    const unsortedNodes: AipmAgentMapNodeType[] = nodes.map((node) => ({
      id: node.id,
      type: 'aipmNode' as const,
      data: node as AipmMapNodeData,
      position: { x: 0, y: 0 },
      selected: node.id === selectedNodeId,
    }));

    const flowEdges: AipmAgentMapEdgeType[] = edges.map((edge) => ({
      id: edge.id,
      type: 'aipmEdge',
      source: edge.source,
      target: edge.target,
      data: edge as AipmMapEdgeData,
    }));

    return applyGraphLayout(unsortedNodes, flowEdges);
  }, [nodes, edges, selectedNodeId]);

  const flowEdges = useMemo<AipmAgentMapEdgeType[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        type: 'aipmEdge' as const,
        source: edge.source,
        target: edge.target,
        data: edge as AipmMapEdgeData,
        selected: edge.id === selectedEdgeId,
      })),
    [edges, selectedEdgeId]
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const hasInitialFocus = Boolean(initialFocusedNodeId || initialFocusedEdgeId);

  useEffect(() => {
    if (!hasInitialFocus) {
      return;
    }

    const focusedNode =
      flowNodes.find((node) => node.id === initialFocusedNodeId) ??
      flowNodes.find((node) => node.id === selectedEdge?.source);

    if (!focusedNode) {
      return;
    }

    setCenter(
      focusedNode.position.x + AIPM_AGENT_MAP_NODE_WIDTH / 2,
      focusedNode.position.y + AIPM_AGENT_MAP_NODE_HEIGHT / 2,
      { duration: 0, zoom: 0.85 }
    );
  }, [flowNodes, hasInitialFocus, initialFocusedNodeId, selectedEdge?.source, setCenter]);

  return (
    <>
      <div
        style={{
          height,
          width: '100%',
          minWidth: 0,
          borderRadius: euiTheme.border.radius.medium,
          overflow: 'hidden',
        }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={!hasInitialFocus}
          fitViewOptions={{ padding: 0.18, maxZoom: 0.95 }}
          minZoom={0.25}
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
          {showMiniMap ? (
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
          ) : null}
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
  height = 640,
  showMiniMap = true,
  focusedNodeId,
  focusedEdgeId,
}: {
  nodes: AipmTraceMapNode[];
  edges: AipmTraceMapEdge[];
  buildApmHref: (apmQuery: string) => string;
  height?: number;
  showMiniMap?: boolean;
  focusedNodeId?: string;
  focusedEdgeId?: string;
}) {
  return (
    <ReactFlowProvider>
      <AipmAgentMapInner
        nodes={nodes}
        edges={edges}
        buildApmHref={buildApmHref}
        height={height}
        showMiniMap={showMiniMap}
        focusedNodeId={focusedNodeId}
        focusedEdgeId={focusedEdgeId}
      />
    </ReactFlowProvider>
  );
}
