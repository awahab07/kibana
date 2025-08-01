/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
import { findInventoryModel } from '@kbn/metrics-data-access-plugin/common';
import type { InventoryItemType, SnapshotMetricType } from '@kbn/metrics-data-access-plugin/common';

import type { InventoryMetricConditions } from '../../../../../common/alerting/metrics';
import type { SnapshotCustomMetricInput } from '../../../../../common/http_api';
import { isRate } from './is_rate';

export const calculateFromBasedOnMetric = async (
  to: Date,
  condition: InventoryMetricConditions,
  nodeType: InventoryItemType,
  metric: SnapshotMetricType,
  customMetric?: SnapshotCustomMetricInput
) => {
  const inventoryModel = findInventoryModel(nodeType);

  const aggregations = await inventoryModel.metrics.getAggregations();

  const metricAgg = aggregations.get(metric);

  if (isRate(metricAgg, customMetric)) {
    return moment(to)
      .subtract(condition.timeSize * 2, condition.timeUnit)
      .valueOf();
  } else {
    return moment(to).subtract(condition.timeSize, condition.timeUnit).valueOf();
  }
};
