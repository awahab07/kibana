/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DATA_DATASETS_INDEX_PATTERNS_UNIQUE } from '@kbn/telemetry-plugin/server/telemetry_collection/get_data_telemetry/constants';

import { DatasetIndexPattern } from './types';

export const STARTUP_DELAY = 10 * 60 * 60 * 1000; // 10 hours
export const TELEMETRY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export const BREATHE_DELAY_SHORT = 1000; // 1 seconds
export const BREATHE_DELAY_MEDIUM = 5 * 1000; // 5 seconds
export const BREATHE_DELAY_LONG = 60 * 1000; // 1 minute

export const MAX_STREAMS_TO_REPORT = 1000;

export const NON_LOG_SIGNALS = ['metrics', 'traces', 'internal', 'synthetics'];
export const EXCLUDE_ELASTIC_LOGS = ['logs-synth', 'logs-elastic', 'logs-endpoint'];

export const TELEMETRY_CHANNEL = 'logs-data-telemetry';

const LOGS_INDEX_PATTERN_NAMES = [
  'filebeat',
  'generic-filebeat',
  'metricbeat',
  'generic-metricbeat',
  'apm',
  'functionbeat',
  'generic-functionbeat',
  'heartbeat',
  'generic-heartbeat',
  'logstash',
  'generic-logstash',
  'fluentd',
  'telegraf',
  'prometheusbeat',
  'fluentbit',
  'nginx',
  'apache',
  'generic-logs',
];

const TELEMETRY_PATTERNS_BY_NAME = DATA_DATASETS_INDEX_PATTERNS_UNIQUE.reduce((acc, pattern) => {
  acc[pattern.patternName] = [pattern, ...(acc[pattern.patternName] || [])];
  return acc;
}, {} as Record<string, DatasetIndexPattern[]>);

export const LOGS_DATASET_INDEX_PATTERNS = LOGS_INDEX_PATTERN_NAMES.reduce<DatasetIndexPattern[]>(
  (acc, patternName) => {
    return [...acc, ...(TELEMETRY_PATTERNS_BY_NAME[patternName] || [])];
  },
  []
);
