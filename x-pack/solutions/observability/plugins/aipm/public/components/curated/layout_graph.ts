/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;

export function applyGraphLayout<T extends Node>(nodes: T[], edges: Edge[]) {
  const graph = new Dagre.graphlib.Graph()
    .setGraph({
      rankdir: 'LR',
      ranksep: 100,
      nodesep: 70,
      marginx: 30,
      marginy: 30,
    })
    .setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
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
        x: Math.round((position?.x ?? NODE_WIDTH / 2) - NODE_WIDTH / 2),
        y: Math.round((position?.y ?? NODE_HEIGHT / 2) - NODE_HEIGHT / 2),
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}
