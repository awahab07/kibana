/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { encode } from '@kbn/rison';
import { v4 as uuidv4 } from 'uuid';
import { set } from '@kbn/safer-lodash-set';
import type { LinkDescriptor } from '@kbn/observability-shared-plugin/public';
import { TIMESTAMP_FIELD } from '../../../../../../common/constants';
import { colorTransformer, Color } from '../../../../../../common/color_palette';
import type { MetricsExplorerSeries } from '../../../../../../common/http_api/metrics_explorer';
import type {
  MetricsExplorerOptions,
  MetricsExplorerOptionsMetric,
  MetricsExplorerTimeOptions,
  MetricsExplorerChartOptions,
} from '../../hooks/use_metrics_explorer_options';
import {
  MetricsExplorerYAxisMode,
  MetricsExplorerChartType,
} from '../../hooks/use_metrics_explorer_options';
import { metricToFormat } from './metric_to_format';
import { InfraFormatterType } from '../../../../../common/inventory/types';
import { createMetricLabel } from './create_metric_label';

/*
 We've recently changed the default index pattern in Metrics UI from `metricbeat-*` to
 `metrics-*,metricbeat-*`. There is a bug in TSVB when there is an empty index in the pattern
 the field dropdowns are not populated correctly. This index pattern is a temporary fix.
 See: https://github.com/elastic/kibana/issues/73987
*/
export const TSVB_WORKAROUND_INDEX_PATTERN = 'metric*';

export const metricsExplorerMetricToTSVBMetric = (metric: MetricsExplorerOptionsMetric) => {
  if (metric.aggregation === 'rate') {
    const metricId = uuidv4();
    const positiveOnlyId = uuidv4();
    const derivativeId = uuidv4();
    return [
      {
        id: metricId,
        type: 'max',
        field: metric.field || void 0,
      },
      {
        id: derivativeId,
        type: 'derivative',
        field: metricId,
        unit: '1s',
      },
      {
        id: positiveOnlyId,
        type: 'positive_only',
        field: derivativeId,
      },
    ];
  } else if (metric.aggregation === 'p95' || metric.aggregation === 'p99') {
    const percentileValue = metric.aggregation === 'p95' ? '95' : '99';
    return [
      {
        id: uuidv4(),
        type: 'percentile',
        field: metric.field,
        percentiles: [
          {
            id: uuidv4(),
            value: percentileValue,
            mode: 'line',
            percentile: '',
            shade: 0.2,
          },
        ],
      },
    ];
  } else {
    return [
      {
        id: uuidv4(),
        type: metric.aggregation,
        field: metric.field || void 0,
      },
    ];
  }
};

const mapMetricToSeries =
  (chartOptions: MetricsExplorerChartOptions) => (metric: MetricsExplorerOptionsMetric) => {
    const format = metricToFormat(metric);
    return {
      label: createMetricLabel(metric),
      axis_position: 'right',
      chart_type: 'line',
      color: (metric.color && colorTransformer(metric.color)) || colorTransformer(Color.color0),
      fill: chartOptions.type === MetricsExplorerChartType.area ? 0.5 : 0,
      formatter: format === InfraFormatterType.bits ? InfraFormatterType.bytes : format,
      value_template: 'rate' === metric.aggregation ? '{{value}}/s' : '{{value}}',
      id: uuidv4(),
      line_width: 2,
      metrics: metricsExplorerMetricToTSVBMetric(metric),
      point_size: 0,
      separate_axis: 0,
      split_mode: 'everything',
      stacked: chartOptions.stack ? 'stacked' : 'none',
    };
  };

export const createFilterFromOptions = (
  options: MetricsExplorerOptions,
  series: MetricsExplorerSeries
) => {
  const filters = [];
  if (options.filterQuery) {
    filters.push(options.filterQuery);
  }
  if (options.groupBy) {
    const id = series.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const groupByFilters = Array.isArray(options.groupBy)
      ? options.groupBy
          .map((field, index) => {
            if (!series.keys) {
              return null;
            }
            const value = series.keys[index];
            if (!value) {
              return null;
            }
            return `${field}: "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
          })
          .join(' and ')
      : `${options.groupBy} : "${id}"`;
    filters.push(groupByFilters);
  }
  return { language: 'kuery', query: filters.join(' and ') };
};

const createTSVBIndexPattern = (alias: string) => {
  if (alias.split(',').length > 1) {
    return TSVB_WORKAROUND_INDEX_PATTERN;
  }
  return alias;
};

export const createTSVBLink = (
  indexPattern: string,
  options: MetricsExplorerOptions,
  series: MetricsExplorerSeries,
  timeRange: MetricsExplorerTimeOptions,
  chartOptions: MetricsExplorerChartOptions
): LinkDescriptor => {
  const tsvbIndexPattern = createTSVBIndexPattern(indexPattern);
  const appState = {
    filters: [],
    linked: false,
    query: { language: 'kuery', query: '' },
    uiState: {},
    vis: {
      aggs: [],
      params: {
        axis_formatter: 'number',
        axis_position: 'left',
        axis_scale: 'normal',
        id: uuidv4(),
        default_index_pattern: tsvbIndexPattern,
        index_pattern: tsvbIndexPattern,
        interval: 'auto',
        series: options.metrics.map(mapMetricToSeries(chartOptions)),
        show_grid: 1,
        show_legend: 1,
        time_field: TIMESTAMP_FIELD,
        type: 'timeseries',
        filter: createFilterFromOptions(options, series),
      },
      title: series.id,
      type: 'metrics',
    },
  };

  if (chartOptions.yAxisMode === MetricsExplorerYAxisMode.fromZero) {
    set(appState, 'vis.params.axis_min', 0);
  }

  const globalState = {
    refreshInterval: { pause: true, value: 0 },
    time: { from: timeRange.from, to: timeRange.to },
  };

  return {
    app: 'visualize',
    hash: '/create',
    search: {
      type: 'metrics',
      _g: encode(globalState),
      _a: encode(appState as any),
    },
  };
};
