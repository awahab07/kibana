/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

import { RouteDependencies } from '../../../types';
import { addBasePath } from '..';
import { executeAsyncByChunks } from './helpers';

const bodySchema = schema.object({
  indices: schema.arrayOf(schema.string()),
});

export function registerRefreshRoute({ router, lib: { handleEsError } }: RouteDependencies) {
  router.post(
    {
      path: addBasePath('/indices/refresh'),
      security: {
        authz: {
          enabled: false,
          reason: 'Relies on es client for authorization',
        },
      },
      validate: { body: bodySchema },
    },
    async (context, request, response) => {
      const { client } = (await context.core).elasticsearch;
      const { indices = [] } = request.body as typeof bodySchema.type;

      const params = {
        expand_wildcards: 'none' as const,
        format: 'json',
        index: indices,
      };

      try {
        await executeAsyncByChunks(params, client, 'refresh');

        return response.ok();
      } catch (error) {
        return handleEsError({ error, response });
      }
    }
  );
}
