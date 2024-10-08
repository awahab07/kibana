/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { setWriteBlock } from './set_write_block';
import { elasticsearchClientMock } from '@kbn/core-elasticsearch-client-server-mocks';
import { catchRetryableEsClientErrors } from './catch_retryable_es_client_errors';
import { errors as EsErrors } from '@elastic/elasticsearch';

jest.mock('./catch_retryable_es_client_errors');

describe('setWriteBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Create a mock client that rejects all methods with a 503 status code
  // response.
  const retryableError = new EsErrors.ResponseError(
    elasticsearchClientMock.createApiResponse({
      statusCode: 503,
      body: { error: { type: 'es_type', reason: 'es_reason' } },
    })
  );
  const client = elasticsearchClientMock.createInternalClient(
    elasticsearchClientMock.createErrorTransportRequestPromise(retryableError)
  );

  const nonRetryableError = new Error('crash');
  const clientWithNonRetryableError = elasticsearchClientMock.createInternalClient(
    elasticsearchClientMock.createErrorTransportRequestPromise(nonRetryableError)
  );
  it('calls catchRetryableEsClientErrors when the promise rejects', async () => {
    const task = setWriteBlock({ client, index: 'my_index' });
    try {
      await task();
    } catch (e) {
      /** ignore */
    }
    expect(catchRetryableEsClientErrors).toHaveBeenCalledWith(retryableError);
  });
  it('re-throws non retry-able errors', async () => {
    const task = setWriteBlock({
      client: clientWithNonRetryableError,
      index: 'my_index',
    });
    await task();
    expect(catchRetryableEsClientErrors).toHaveBeenCalledWith(nonRetryableError);
  });
});
