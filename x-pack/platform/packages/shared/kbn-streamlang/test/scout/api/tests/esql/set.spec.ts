/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { expect } from '@kbn/scout';
import type { SetProcessor, StreamlangDSL } from '../../../../..';
import { transpile } from '../../../../../src/transpilers/esql';
import { streamlangApiTest } from '../..';

streamlangApiTest.describe(
  'Streamlang to ES|QL - Set Processor',
  { tag: ['@ess', '@svlOblt'] },
  () => {
    streamlangApiTest('should set a field using a value', async ({ testBed, esql }) => {
      const indexName = 'stream-e2e-test-set-value';

      const streamlangDSL: StreamlangDSL = {
        steps: [
          {
            action: 'set',
            to: 'attributes.status',
            value: 'active',
          } as SetProcessor,
        ],
      };

      const { query } = transpile(streamlangDSL);

      const docs = [{ attributes: { size: 4096 } }];
      await testBed.ingest(indexName, docs);
      const esqlResult = await esql.queryOnIndex(indexName, query);

      // `toHaveProperty` doesn't work with flattened ES|QL Rows/Documents
      expect(esqlResult.documents[0]).toEqual(
        expect.objectContaining({
          'attributes.status': 'active',
        })
      );
    });

    streamlangApiTest(
      'should escape (and not parse) template syntax {{ and {{{',
      async ({ testBed, esql }) => {
        const indexName = 'stream-e2e-test-set-escape-template';

        const streamlangDSL: StreamlangDSL = {
          steps: [
            {
              action: 'set',
              to: '{{attributes.status}}',
              value: '{{{value}}}',
            } as SetProcessor,
          ],
        };

        const { query } = transpile(streamlangDSL);

        const docs = [{ attributes: { size: 4096 } }];
        await testBed.ingest(indexName, docs);
        const esqlResult = await esql.queryOnIndex(indexName, query);

        // `toHaveProperty` doesn't work with flattened ES|QL Rows/Documents
        expect(esqlResult.documents[0]).toEqual(
          expect.objectContaining({
            '{{attributes.status}}': '{{{value}}}',
          })
        );
      }
    );

    streamlangApiTest('should not set a field when where is false', async ({ testBed, esql }) => {
      const indexName = 'stream-e2e-test-set-where-false';

      const streamlangDSL: StreamlangDSL = {
        steps: [
          {
            action: 'set',
            to: 'attributes.status',
            value: 'active',
            where: {
              field: 'attributes.should_exist',
              exists: true,
            },
            override: false,
          } as SetProcessor,
        ],
      };

      const { query } = transpile(streamlangDSL);

      // ES|QL errors out when unmapped fields (columns) are read
      // The following docs helps map the fields for which ES|QL has to perform nullability checks
      const mappingDoc = { attributes: { should_exist: null, status: 'null' } };
      const docs = [
        mappingDoc,
        { attributes: { size: 4096, should_exist: 'YES' } },
        { attributes: { size: 2048 } },
      ];
      await testBed.ingest(indexName, docs);
      const esqlResult = await esql.queryOnIndex(indexName, query);

      // The field should be set since `attributes.status` doesn't exist where attributes.should_exist exists
      expect(esqlResult.documents[1]).toEqual(
        expect.objectContaining({
          'attributes.size': 4096,
          'attributes.should_exist': 'YES',
          'attributes.status': 'active',
        })
      );

      // The field should not be set since `attributes.should_exist` doesn't exist
      expect(esqlResult.documents[2]).toEqual(
        expect.objectContaining({
          'attributes.size': 2048,
          'attributes.status': null,
        })
      );
    });

    streamlangApiTest(
      'should set a field by copying from another field',
      async ({ testBed, esql }) => {
        const indexName = 'stream-e2e-test-set-copy';

        const streamlangDSL: StreamlangDSL = {
          steps: [
            {
              action: 'set',
              to: 'attributes.status',
              copy_from: 'message',
            } as SetProcessor,
          ],
        };

        const { query } = transpile(streamlangDSL);

        const docs = [{ message: 'should-be-copied' }];
        await testBed.ingest(indexName, docs);
        const esqlResult = await esql.queryOnIndex(indexName, query);
        expect(esqlResult.documents[0]).toEqual(
          expect.objectContaining({
            'attributes.status': 'should-be-copied',
          })
        );
      }
    );

    streamlangApiTest(
      'should not override an existing field when override is false',
      async ({ testBed, esql }) => {
        const indexName = 'stream-e2e-test-set-no-override';

        const streamlangDSL: StreamlangDSL = {
          steps: [
            {
              action: 'set',
              to: 'attributes.status',
              value: 'inactive',
              override: false,
            } as SetProcessor,
          ],
        };

        const { query } = transpile(streamlangDSL);
        const docWithStatus = { attributes: { status: 'active' } }; // 'attributes.status' already exists
        const docs = [docWithStatus, { attributes: { size: 1024 } }];
        await testBed.ingest(indexName, docs);
        const esqlResult = await esql.queryOnIndex(indexName, query);

        expect(esqlResult.documents[0]).toEqual(
          expect.objectContaining({
            'attributes.status': 'active', // Should not be overridden
          })
        );

        expect(esqlResult.documents[1]).toEqual(
          expect.objectContaining({
            'attributes.status': 'inactive', // Should be set
          })
        );
      }
    );

    streamlangApiTest(
      'should override an existing field when override is true',
      async ({ testBed, esql }) => {
        const indexName = 'stream-e2e-test-set-override';

        const streamlangDSL: StreamlangDSL = {
          steps: [
            {
              action: 'set',
              to: 'attributes.status',
              value: 'inactive',
              override: true,
            } as SetProcessor,
          ],
        };

        const { query } = transpile(streamlangDSL);
        const docs = [{ attributes: { status: 'active' } }]; // 'attributes.status' already exists
        await testBed.ingest(indexName, docs);
        const esqlResult = await esql.queryOnIndex(indexName, query);
        expect(esqlResult.documents[0]).toEqual(
          expect.objectContaining({
            'attributes.status': 'inactive',
          })
        );
      }
    );

    streamlangApiTest('should throw error if value and copy_from are missing', async () => {
      const streamlangDSL: StreamlangDSL = {
        steps: [
          {
            action: 'set',
            to: 'attributes.status',
          } as SetProcessor,
        ],
      };

      await expect(() => transpile(streamlangDSL)).toThrowError();
    });

    streamlangApiTest('should throw error if value and copy_from are both present', async () => {
      const streamlangDSL: StreamlangDSL = {
        steps: [
          {
            action: 'set',
            to: 'attributes.status',
            value: 'active',
            copy_from: 'message',
          } as SetProcessor,
        ],
      };

      await expect(() => transpile(streamlangDSL)).toThrowError();
    });
  }
);
