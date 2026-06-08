/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { css } from '@emotion/react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { EuiBadge, useEuiTheme } from '@elastic/eui';
import type { AipmTraceMapEdge } from '../../../common';

export type AipmMapEdgeData = AipmTraceMapEdge & Record<string, unknown>;
export type AipmAgentMapEdgeType = Edge<AipmMapEdgeData, 'aipmEdge'>;

export function AipmAgentMapEdge({
  data,
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps<AipmAgentMapEdgeType>) {
  const { euiTheme } = useEuiTheme();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const labelStyles = css`
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: selected ? euiTheme.colors.primary : euiTheme.colors.mediumShade,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            css={labelStyles}
            style={{
              position: 'absolute',
              left: labelX,
              top: labelY,
            }}
          >
            <EuiBadge color={selected ? 'primary' : 'hollow'}>{data.label}</EuiBadge>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
