/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import type { IRouter } from '@kbn/core/server';
import {
  AIPM_FEATURE_DESCRIPTOR_BY_ID,
  AIPM_TOP_FEATURE_DESCRIPTORS,
  AIPM_DATA_ROLE_VALUES,
  AIPM_SCHEMA_CATALOG_PACKAGE_NAME,
  AIPM_SOURCE_TIER_VALUES,
} from '@kbn/aipm-schema-catalog';
import {
  AIPM_BOOTSTRAP_API_PATH,
  AIPM_FEATURE_OVERVIEW_API_PATH,
  EXPERIMENTS_ARTIFACT_LABEL,
  PLAYGROUND_SURFACE_LABEL,
  PLUGIN_ID,
  PLUGIN_NAME,
  type AipmBootstrapRouteResponse,
  type AipmFeatureOverviewRouteResponse,
} from '../../common';
import { getAipmFeatureOverview } from '../lib/get_feature_overview';

export function defineRoutes(router: IRouter) {
  router.get(
    {
      path: AIPM_BOOTSTRAP_API_PATH,
      validate: {
        query: schema.object({}),
      },
      options: {
        access: 'internal',
      },
      security: {
        authz: {
          enabled: false,
          reason: 'AIPM showcase routes do not register feature privileges yet.',
        },
      },
    },
    async (_context, _request, response) => {
      const body: AipmBootstrapRouteResponse = {
        pluginId: PLUGIN_ID,
        pluginName: PLUGIN_NAME,
        schemaPackage: AIPM_SCHEMA_CATALOG_PACKAGE_NAME,
        firstSurface: PLAYGROUND_SURFACE_LABEL,
        firstSavedArtifact: EXPERIMENTS_ARTIFACT_LABEL,
        sourceTiers: [...AIPM_SOURCE_TIER_VALUES],
        dataRoles: [...AIPM_DATA_ROLE_VALUES],
        initialFeature: AIPM_FEATURE_DESCRIPTOR_BY_ID.playground,
        featureCatalog: [...AIPM_TOP_FEATURE_DESCRIPTORS],
      };

      return response.ok({ body });
    }
  );

  router.get(
    {
      path: AIPM_FEATURE_OVERVIEW_API_PATH,
      validate: {
        query: schema.object({}),
      },
      options: {
        access: 'internal',
      },
      security: {
        authz: {
          enabled: false,
          reason: 'AIPM showcase routes do not register feature privileges yet.',
        },
      },
    },
    async (context, _request, response) => {
      const esClient = (await context.core).elasticsearch.client.asCurrentUser;
      const body: AipmFeatureOverviewRouteResponse = await getAipmFeatureOverview(esClient);

      return response.ok({ body });
    }
  );
}
