/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from 'kibana/server';
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
  // TODO: Retrieve documents from es via apmClient and generate script
  const inlineScript = `
      step('Goto Amazon', () => {
        page.goto('https://amazon.com');
      });
    `;

  return { inlineScript };
}
