/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { expect } from '@kbn/scout';
import type { GrokProcessor, StreamlangDSL } from '../../../../..';
import { transpile as asIngest } from '../../../../../src/transpilers/ingest_pipeline';
import { transpile as asEsql } from '../../../../../src/transpilers/esql';
import { streamlangApiTest } from '../..';

streamlangApiTest.describe(
  'Cross-compatibility - Grok Processor',
  { tag: ['@ess', '@svlOblt'] },
  () => {
    streamlangApiTest.describe('Compatible', () => {
      streamlangApiTest(
        'should correctly parse a log line with the grok processor',
        async ({ testBed, esql }) => {
          const streamlangDSL: StreamlangDSL = {
            steps: [
              {
                action: 'grok',
                from: 'message',
                patterns: [
                  '%{IP:client.ip} %{WORD:http.request.method} %{URIPATHPARAM:url.path} %{NUMBER:http.response.body.bytes} %{NUMBER:event.duration}',
                ],
              } as GrokProcessor,
            ],
          };

          const { processors } = asIngest(streamlangDSL);
          const { query } = asEsql(streamlangDSL);

          const docs = [{ message: '55.3.244.1 GET /index.html 15824 0.043' }];
          await testBed.ingest('ingest-grok', docs, processors);
          const ingestResult = await testBed.getFlattenedDocs('ingest-grok');

          await testBed.ingest('esql-grok', docs);
          const esqlResult = await esql.queryOnIndex('esql-grok', query);

          expect(ingestResult[0]).toEqual(esqlResult.documentsWithoutKeywords[0]);
        }
      );

      streamlangApiTest(
        'should support where clause both in ingest, but not in ES|QL',
        async ({ testBed, esql }) => {
          const streamlangDSL: StreamlangDSL = {
            steps: [
              {
                action: 'grok',
                from: 'message',
                patterns: ['%{IP:client.ip}'],
                where: {
                  field: 'attributes.should_exist',
                  exists: true,
                },
              } as GrokProcessor,
            ],
          };

          const { processors } = asIngest(streamlangDSL);
          const { query } = asEsql(streamlangDSL);

          const docs = [
            { case: 'groked', attributes: { should_exist: 'YES' }, message: '55.3.244.1' },
            { case: 'missing', attributes: { size: 2048 }, message: '127.0.0.1' },
          ];
          await testBed.ingest('ingest-grok-where', docs, processors);
          const ingestResult = await testBed.getFlattenedDocs('ingest-grok-where');

          const docForMapping = { client: { ip: '' } };
          await testBed.ingest('esql-grok-where', [docForMapping, ...docs]);
          const esqlResult = await esql.queryOnIndex('esql-grok-where', query);

          // Loop is needed as ES|QL's FORK may return documents in different order
          for (const doc of esqlResult.documents) {
            switch (doc.case) {
              case 'missing':
                // NOTE that ES|QL returns null for an ignored but mapped field, whereas ingest simply doesn't add the field
                expect(ingestResult[1]['client.ip']).toBeUndefined();
                expect(doc['client.ip']).toBeNull();
                break;
              case 'groked':
                expect(ingestResult[0]['client.ip']).toEqual('55.3.244.1');
                expect(doc['client.ip']).toEqual('55.3.244.1');
                break;
            }
          }
        }
      );

      // TODO: Implement
      streamlangApiTest(
        'should handle custom oniguruma patterns in both ingest and ES|QL',
        async ({ testBed, esql }) => {
          //
        }
      );

      // TODO: Implement
      streamlangApiTest(
        'should handle same field captured multiple times in both ingest and ES|QL',
        async ({ testBed, esql }) => {
          //
        }
      );

      // TODO: Implement
      streamlangApiTest(
        'should nullify ungroked fields in the doc when only partial groking is possible',
        async ({ testBed, esql }) => {
          //
        }
      );

      // TODO: Implement
      // ES|QL may need escaping if """ aren't used e.g for pattern "%{IP:ip} \[%{TIMESTAMP_ISO8601:@timestamp}\] %{GREEDYDATA:status}"
      streamlangApiTest(
        'should support special character in grok regex patterns in both ingest and ES|QL',
        async ({ testBed, esql }) => {
          //
        }
      );

      // TODO: Implement
      streamlangApiTest(
        'should leave the source field intact if not present in pattern',
        async ({ testBed, esql }) => {}
      );

      // TODO: Implement
      streamlangApiTest(
        'should coerce float values to integer if mapped type is long and GROK is :float',
        async ({ testBed, esql }) => {}
      );
    });

    streamlangApiTest.describe('Incompatible', () => {
      streamlangApiTest(
        'should fail in ingest, but not in ES|QL when field is missing and ignore_missing is false',
        async ({ testBed, esql }) => {
          const streamlangDSL: StreamlangDSL = {
            steps: [
              {
                action: 'grok',
                from: 'message',
                patterns: ['%{IP:client.ip}'],
                ignore_missing: false,
              } as GrokProcessor,
            ],
          };

          const { processors } = asIngest(streamlangDSL);
          const { query } = asEsql(streamlangDSL);

          const docs = [{ log: { level: 'info' } }];
          const { errors } = await testBed.ingest('ingest-grok-fail', docs, processors);
          expect(errors[0]).toMatchObject({
            type: 'illegal_argument_exception',
          });

          const docForMapping = { message: '' };
          await testBed.ingest('esql-grok-fail', [docForMapping, ...docs]);
          const esqlResult = await esql.queryOnIndex('esql-grok-fail', query);
          expect(esqlResult.documents[1]['client.ip']).toBeUndefined(); // ES|QL returns undefined for unmapped fields
        }
      );
    });
  }
);
