/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export function createSyntheticActions(replayData: any) {
  const actions: any[] = [];

  replayData.forEach((entry: any, index: any) => {
    const { enriched } = entry;
    if (enriched.type === 'page') {
      actions.push({
        pageAlias: 'page',
        isMainFrame: true,
        frameUrl: entry.data.href,
        committed: true,
        action: {
          name: 'navigate',
          url: entry.data.href,
          signals: [],
        },
      });
    }

    if (enriched.type === 'click') {
      actions.push({
        pageAlias: 'page',
        isMainFrame: true,
        frameUrl: enriched.pageUrl,
        action: {
          name: enriched.type,
          selector: enriched.selectorId,
          signals: [],
        },
        committed: true,
      });
    }

    if (enriched.type === 'input') {
      const nextEntry = replayData[index + 1];

      // to avoid having an action for every character typed
      if (
        nextEntry &&
        nextEntry.enriched.type === 'input' &&
        nextEntry.enriched.selectorId === enriched.selectorId
      ) {
        return;
      }

      actions.push({
        pageAlias: 'page',
        isMainFrame: true,
        frameUrl: enriched.pageUrl,
        action: {
          name: 'fill',
          text: entry.data.text,
          selector: enriched.selectorId,
          signals: [],
        },
        committed: true,
      });
    }
  });

  return actions;
}
