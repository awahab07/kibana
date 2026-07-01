/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';

export const AIPM_AGENT_MAP_NODE_WIDTH = 320;
export const AIPM_AGENT_MAP_NODE_HEIGHT = 140;

export function applyGraphLayout<T extends Node>(nodes: T[], edges: Edge[]) {
  const graph = new Dagre.graphlib.Graph()
    .setGraph({
      rankdir: 'LR',
      ranker: 'network-simplex',
      acyclicer: 'greedy',
      ranksep: 112,
      nodesep: 48,
      marginx: 24,
      marginy: 24,
    })
    .setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: AIPM_AGENT_MAP_NODE_WIDTH,
      height: AIPM_AGENT_MAP_NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  });

  Dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);

    return {
      ...node,
      position: {
        x: Math.round(
          (position?.x ?? AIPM_AGENT_MAP_NODE_WIDTH / 2) - AIPM_AGENT_MAP_NODE_WIDTH / 2
        ),
        y: Math.round(
          (position?.y ?? AIPM_AGENT_MAP_NODE_HEIGHT / 2) - AIPM_AGENT_MAP_NODE_HEIGHT / 2
        ),
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}
