/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export function formatDurationUs(value: number | undefined) {
  if (!value || value <= 0) {
    return 'n/a';
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}s`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}ms`;
  }

  return `${value.toFixed(0)}us`;
}

export function formatCurrency(value: number | undefined) {
  if (value === undefined) {
    return 'n/a';
  }

  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

export function formatRating(value: string | undefined) {
  if (!value) {
    return 'unrated';
  }

  if (value === 'thumbs_up') {
    return 'thumbs up';
  }

  if (value === 'thumbs_down') {
    return 'thumbs down';
  }

  return value;
}

export function previewText(value: string | undefined, limit = 140) {
  if (!value) {
    return undefined;
  }

  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

export function getNodeKindColor(nodeKind: string, outcome?: string) {
  if (outcome === 'failure') {
    return 'danger';
  }

  switch (nodeKind) {
    case 'prompt':
      return 'primary';
    case 'agent':
      return 'accent';
    case 'guardrail':
      return 'warning';
    case 'model':
      return 'accent';
    case 'retriever':
      return 'success';
    case 'tool':
      return 'accent';
    case 'mcp':
      return 'warning';
    case 'service':
      return 'hollow';
    case 'evaluator':
      return 'success';
    case 'feedback':
      return outcome === 'success' ? 'success' : 'danger';
    case 'response':
      return outcome === 'success' ? 'success' : 'warning';
    default:
      return 'hollow';
  }
}

export function getNodeKindLabel(nodeKind: string) {
  switch (nodeKind) {
    case 'prompt':
      return 'Prompt';
    case 'agent':
      return 'Agent';
    case 'guardrail':
      return 'Guardrail';
    case 'model':
      return 'Model';
    case 'retriever':
      return 'Retriever';
    case 'tool':
      return 'Tool';
    case 'mcp':
      return 'MCP';
    case 'service':
      return 'Service';
    case 'evaluator':
      return 'Judge';
    case 'feedback':
      return 'Feedback';
    case 'response':
      return 'Response';
    default:
      return 'Step';
  }
}
