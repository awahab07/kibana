/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { expect } from '@kbn/scout';
import type { SetProcessor, StreamlangDSL } from '../../../../..';
import { transpile } from '../../../../../src/transpilers/ingest_pipeline';
import { streamlangApiTest } from '../..';

streamlangApiTest.describe(
  'Streamlang to Ingest Pipeline - Set Processor',
  { tag: ['@ess', '@svlOblt'] },
  () => {
    streamlangApiTest('should set a field using a value', async ({ testBed }) => {
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

      const { processors } = transpile(streamlangDSL);

      const docs = [{ attributes: { size: 4096 } }];
      await testBed.ingest(indexName, docs, processors);

      const ingestedDocs = await testBed.getDocs(indexName);
      expect(ingestedDocs).toHaveProperty('[0]attributes.status', 'active');
    });

    [
      {
        templateValue: '{{value}}',
        templateTo: '{{templated_to}}',
        description: 'should set a field using {{ }} template',
      },
      {
        templateValue: '{{{value}}}',
        templateTo: '{{templated_to}}',
        description: 'should set a field using {{{ }}} template',
      },
    ].forEach(({ templateValue, templateTo, description }) => {
      streamlangApiTest(description, async ({ testBed }) => {
        const indexName = 'stream-e2e-test-set-template';

        const streamlangDSL: StreamlangDSL = {
          steps: [
            {
              action: 'set',
              to: templateTo,
              value: templateValue,
            } as SetProcessor,
          ],
        };

        const { processors } = transpile(streamlangDSL);

        const docs = [{ value: 'templated-value', templated_to: 'attributes.status' }];
        await testBed.ingest(indexName, docs, processors);

        const ingestedDocs = await testBed.getDocs(indexName);
        expect(ingestedDocs).toHaveProperty('[0]attributes.status', 'templated-value');
      });
    });

    streamlangApiTest('should set a field by copying from another field', async ({ testBed }) => {
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

      const { processors } = transpile(streamlangDSL);

      const docs = [{ message: 'should-be-copied' }];
      await testBed.ingest(indexName, docs, processors);

      const ingestedDocs = await testBed.getDocs(indexName);
      expect(ingestedDocs).toHaveProperty('[0]attributes.status', 'should-be-copied');
    });

    streamlangApiTest(
      'should not override an existing field when override is false',
      async ({ testBed }) => {
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

        const { processors } = transpile(streamlangDSL);

        const docs = [{ attributes: { status: 'active' } }];
        await testBed.ingest(indexName, docs, processors);

        const ingestedDocs = await testBed.getDocs(indexName);
        expect(ingestedDocs).toHaveProperty('[0]attributes.status', 'active');
      }
    );

    streamlangApiTest(
      'should override an existing field when override is true',
      async ({ testBed }) => {
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

        const { processors } = transpile(streamlangDSL);

        const docs = [{ attributes: { status: 'active' } }];
        await testBed.ingest(indexName, docs, processors);

        const ingestedDocs = await testBed.getDocs(indexName);
        expect(ingestedDocs).toHaveProperty('[0]attributes.status', 'inactive');
      }
    );

    streamlangApiTest(
      'should throw error if value and copy_from are missing',
      async ({ testBed }) => {
        const streamlangDSL: StreamlangDSL = {
          steps: [
            {
              action: 'set',
              to: 'attributes.status',
            } as SetProcessor,
          ],
        };

        const { processors } = transpile(streamlangDSL);
        const docs = [{ attributes: { status: 'active' } }];
        await expect(testBed.ingest('some-index', docs, processors)).rejects.toThrowError();
      }
    );

    streamlangApiTest(
      'should throw error if value and copy_from are both present',
      async ({ testBed }) => {
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

        const { processors } = transpile(streamlangDSL);
        const docs = [{ attributes: { status: 'active' } }];
        await expect(testBed.ingest('some-index', docs, processors)).rejects.toThrowError();
      }
    );
  }
);
