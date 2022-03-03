/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from 'kibana/server';
import { SyntheticsGenerator } from '@elastic/synthetics/dist/formatter/javascript';
import { createSyntheticActions } from '../../lib/helpers/rum_to_synthetics';
import { SetupUX } from './route';

export async function getUserSessions({
  setup,
  start,
  end,
}: {
  setup: SetupUX;
  start: number;
  end: number;
}) {
  const { apmEventClient } = setup;

  const esResponse = await apmEventClient.getUserSessions(start, end);

  // Process raw ES response here if necessary

  return { items: esResponse };
}

export async function getScriptForSessionId({
  esClient,
  sessionId,
}: {
  esClient: ElasticsearchClient;
  sessionId: string;
}) {
  const { hits } = await esClient.search<any>({
    index: 'synthplay_test',
    size: 10000,
    body: {
      query: {
        term: {
          'enriched.sessionId.keyword': {
            value: sessionId,
            boost: 1.0,
          },
        },
      },
      sort: [
        {
          timestamp: {
            order: 'asc',
          },
        },
      ],
    },
  });

  const rumInstructions = hits.hits.map(({ _source }) => _source);

  const synthInstructions = createSyntheticActions(rumInstructions);

  const synthGenerator = new SyntheticsGenerator(false);

  const inlineScript = synthGenerator.generateText(synthInstructions);

  return { inlineScript };
}
