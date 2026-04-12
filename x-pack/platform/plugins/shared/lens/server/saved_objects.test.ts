/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  SavedObjectModelTransformationFn,
  SavedObjectModelTransformationContext,
  SavedObjectModelUnsafeTransformFn,
  SavedObjectsModelVersion,
} from '@kbn/core-saved-objects-server';
import type { CoreSetup, SavedObjectsType } from '@kbn/core/server';
import { LENS_CONTENT_TYPE } from '@kbn/lens-common/content_management/constants';
import { setupSavedObjects } from './saved_objects';
import type { LensDocShape860 } from './migrations/types';

const dummyTypeSafeGuard = <PreviousAttributes, NewAttributes>(
  fn: SavedObjectModelUnsafeTransformFn<PreviousAttributes, NewAttributes>
): SavedObjectModelTransformationFn => fn as SavedObjectModelTransformationFn;

const createVisualizationAttributes = (
  visualizationType: string,
  visualization: Record<string, unknown>
) =>
  ({
    filters: [],
    title: 'Chart',
    expression: '',
    visualizationType,
    state: {
      datasourceMetaData: {
        filterableIndexPatterns: [],
      },
      datasourceStates: {
        formBased: {
          currentIndexPatternId: 'logs-*',
          layers: {
            layer1: {
              columnOrder: ['x'],
              columns: {
                x: {
                  dataType: 'date',
                  isBucketed: true,
                  label: '@timestamp',
                  operationType: 'date_histogram',
                  params: {
                    interval: 'auto',
                    includeEmptyRows: true,
                  },
                  scale: 'interval',
                  sourceField: '@timestamp',
                },
              },
            },
          },
        },
      },
      visualization,
      query: { query: '', language: 'kuery' },
      filters: [],
    },
  } as unknown as LensDocShape860<unknown>);

describe('Lens saved object registration', () => {
  it('registers the empty rows migration as model version 2', () => {
    const registerType = jest.fn();

    setupSavedObjects(
      {
        savedObjects: {
          registerType,
        },
      } as unknown as CoreSetup,
      () => ({}),
      {}
    );

    const lensType = registerType.mock.calls
      .map(([type]) => type as SavedObjectsType)
      .find((type) => type.name === LENS_CONTENT_TYPE);
    const modelVersions = lensType?.modelVersions as Record<string, SavedObjectsModelVersion>;
    const legacyMigrations =
      typeof lensType?.migrations === 'function' ? lensType.migrations() : lensType?.migrations;

    expect(modelVersions?.['2']).toBeDefined();
    expect(legacyMigrations?.['9.4.0']).toBeUndefined();

    const transform = modelVersions?.['2']?.changes[0];
    expect(transform?.type).toBe('unsafe_transform');

    const result =
      transform?.type === 'unsafe_transform'
        ? transform.transformFn(dummyTypeSafeGuard)(
            {
              id: '1',
              type: LENS_CONTENT_TYPE,
              attributes: createVisualizationAttributes('lnsXY', {
                preferredSeriesType: 'bar_stacked',
              }),
            },
            {} as SavedObjectModelTransformationContext
          )
        : undefined;

    const migratedAttributes = result?.document.attributes as LensDocShape860<unknown>;
    expect(
      migratedAttributes.state.datasourceStates.formBased.layers.layer1.columns.x.params
    ).toHaveProperty('includeEmptyRows', false);
  });
});
