/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { SavedObjectWithMetadata } from '@kbn/saved-objects-management-plugin/common';
import { DeploymentAgnosticFtrProviderContext } from '../../ftr_provider_context';
import { SupertestWithRoleScopeType } from '../../services';

export default function ({ getService }: DeploymentAgnosticFtrProviderContext) {
  const kibanaServer = getService('kibanaServer');
  const roleScopedSupertest = getService('roleScopedSupertest');
  let supertestWithAdminScope: SupertestWithRoleScopeType;

  describe('_bulk_delete', () => {
    const endpoint = '/internal/kibana/management/saved_objects/_bulk_delete';
    const validObject = { type: 'visualization', id: 'dd7caf20-9efd-11e7-acb3-3dab96693fab' };
    const invalidObject = { type: 'wigwags', id: 'foo' };

    before(async () => {
      supertestWithAdminScope = await roleScopedSupertest.getSupertestWithRoleScope('admin', {
        withInternalHeaders: true,
      });
    });

    after(async () => {
      await supertestWithAdminScope.destroy();
    });

    beforeEach(() =>
      kibanaServer.importExport.load(
        'src/platform/test/api_integration/fixtures/kbn_archiver/saved_objects/basic.json'
      )
    );
    afterEach(() =>
      kibanaServer.importExport.unload(
        'src/platform/test/api_integration/fixtures/kbn_archiver/saved_objects/basic.json'
      )
    );

    function expectSuccess(index: number, objs: SavedObjectWithMetadata[]) {
      const { type, id, error } = objs[index];
      expect(type).to.eql(validObject.type);
      expect(id).to.eql(validObject.id);
      expect(error).to.equal(undefined);
    }

    function expectBadRequest(index: number, objs: SavedObjectWithMetadata[]) {
      const { type, id, error } = objs[index];
      expect(type).to.eql(invalidObject.type);
      expect(id).to.eql(invalidObject.id);
      expect(error).to.eql({
        message: `Unsupported saved object type: '${invalidObject.type}': Bad Request`,
        statusCode: 400,
        error: 'Bad Request',
      });
    }

    it('should return 200 for an existing object', async () => {
      const { body } = await supertestWithAdminScope.post(endpoint).send([validObject]).expect(200);
      expect(body).to.have.length(1);
      expectSuccess(0, body);
    });

    it('should return error for invalid object type', async () => {
      const { body } = await supertestWithAdminScope
        .post(endpoint)
        .send([invalidObject])
        .expect(200);
      expect(body).to.have.length(1);
      expectBadRequest(0, body);
    });

    it('should return mix of successes and errors', async () => {
      const { body } = await supertestWithAdminScope
        .post(endpoint)
        .send([validObject, invalidObject])
        .expect(200);
      expect(body).to.have.length(2);
      expectSuccess(0, body);
      expectBadRequest(1, body);
    });
  });
}
