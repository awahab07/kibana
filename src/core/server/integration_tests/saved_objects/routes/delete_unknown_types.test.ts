/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import supertest from 'supertest';
import { elasticsearchServiceMock } from '@kbn/core-elasticsearch-server-mocks';
import { typeRegistryMock } from '@kbn/core-saved-objects-base-server-mocks';
import { setupServer } from '@kbn/core-test-helpers-test-utils';
import { SavedObjectsType } from '../../..';
import {
  registerDeleteUnknownTypesRoute,
  type InternalSavedObjectsRequestHandlerContext,
} from '@kbn/core-saved-objects-server-internal';

type SetupServerReturn = Awaited<ReturnType<typeof setupServer>>;

describe('POST /internal/saved_objects/deprecations/_delete_unknown_types', () => {
  const kibanaVersion = '8.0.0';
  const kibanaIndex = '.kibana';

  let server: SetupServerReturn['server'];
  let httpSetup: SetupServerReturn['httpSetup'];
  let handlerContext: SetupServerReturn['handlerContext'];
  let typeRegistry: ReturnType<typeof typeRegistryMock.create>;
  let elasticsearchClient: ReturnType<typeof elasticsearchServiceMock.createScopedClusterClient>;

  beforeEach(async () => {
    ({ server, httpSetup, handlerContext } = await setupServer());
    elasticsearchClient = elasticsearchServiceMock.createScopedClusterClient();
    typeRegistry = typeRegistryMock.create();

    typeRegistry.getAllTypes.mockReturnValue([{ name: 'known-type' } as SavedObjectsType]);
    typeRegistry.getIndex.mockImplementation((type) => `${type}-index`);

    handlerContext.savedObjects.typeRegistry = typeRegistry;
    handlerContext.elasticsearch.client.asCurrentUser = elasticsearchClient.asCurrentUser;
    handlerContext.elasticsearch.client.asInternalUser = elasticsearchClient.asInternalUser;

    const router = httpSetup.createRouter<InternalSavedObjectsRequestHandlerContext>(
      '/internal/saved_objects/'
    );
    registerDeleteUnknownTypesRoute(router, {
      kibanaVersion,
      kibanaIndex,
    });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('formats successful response', async () => {
    const result = await supertest(httpSetup.server.listener)
      .post('/internal/saved_objects/deprecations/_delete_unknown_types')
      .set('x-elastic-internal-origin', 'kibana')
      .expect(200);

    expect(result.body).toEqual({ success: true });
  });

  it('calls upon esClient.deleteByQuery', async () => {
    await supertest(httpSetup.server.listener)
      .post('/internal/saved_objects/deprecations/_delete_unknown_types')
      .set('x-elastic-internal-origin', 'kibana')
      .expect(200);

    expect(elasticsearchClient.asInternalUser.deleteByQuery).toHaveBeenCalledTimes(1);
    expect(elasticsearchClient.asInternalUser.deleteByQuery).toHaveBeenCalledWith({
      index: ['known-type-index_8.0.0'],
      wait_for_completion: false,
      query: {
        bool: {
          must_not: expect.any(Array),
        },
      },
    });
  });
});
