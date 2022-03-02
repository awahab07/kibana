/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

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
  // For simplicity, we can fetch all instructions per sessionId and generate the journey script and add it in
  // the record before returning

  const items = esResponse;
  const itemsWithScript = items.map((i: object) => ({
    ...i,
    inlineScript: `
      step('Goto Amazon', () => {
        page.goto('https://amazon.com');
      });
    `,
  }));

  return { items: itemsWithScript };
}
