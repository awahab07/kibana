/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DateHistogramIndexPatternColumn, TypedLensByValueInput } from '@kbn/lens-common';
import { LensConfigBuilder } from './config_builder';
import { mockDataViewsService } from './charts/mock_utils';

type LensAttributes = TypedLensByValueInput['attributes'];

const getDateHistogramColumn = (attributes: LensAttributes) => {
  const formBasedLayers = attributes.state.datasourceStates.formBased?.layers ?? {};

  for (const layer of Object.values(formBasedLayers)) {
    for (const column of Object.values(layer.columns)) {
      if (column.operationType === 'date_histogram') {
        return column as DateHistogramIndexPatternColumn;
      }
    }
  }
};

describe('LensConfigBuilder', () => {
  it('defaults empty rows off for built metric charts', async () => {
    const builder = new LensConfigBuilder(mockDataViewsService() as any);

    const result = (await builder.build({
      chartType: 'metric',
      title: 'Metric',
      dataset: {
        index: 'test',
        timeFieldName: '@timestamp',
      },
      value: 'count()',
      breakdown: {
        type: 'dateHistogram',
        field: '@timestamp',
      },
    })) as LensAttributes;

    expect(getDateHistogramColumn(result)?.params.includeEmptyRows).toBe(false);
  });

  it('forces empty rows off for built bar charts', async () => {
    const builder = new LensConfigBuilder(mockDataViewsService() as any);

    const result = (await builder.build({
      chartType: 'xy',
      title: 'Bar',
      dataset: {
        index: 'test',
        timeFieldName: '@timestamp',
      },
      layers: [
        {
          type: 'series',
          seriesType: 'bar',
          xAxis: {
            type: 'dateHistogram',
            field: '@timestamp',
          },
          yAxis: [
            {
              value: 'count()',
            },
          ],
        },
      ],
    })) as LensAttributes;

    expect(result.state.visualization).toMatchObject({ preferredSeriesType: 'bar' });
    expect(getDateHistogramColumn(result)?.params.includeEmptyRows).toBe(false);
  });
});
