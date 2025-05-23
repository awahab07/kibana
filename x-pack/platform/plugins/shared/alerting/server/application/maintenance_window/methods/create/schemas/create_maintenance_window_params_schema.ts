/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { rRuleRequestSchema } from '../../../../../../common/routes/r_rule';
import { maintenanceWindowCategoryIdsSchema } from '../../../schemas';

import { alertsFilterQuerySchema } from '../../../../alerts_filter_query/schemas';

export const createMaintenanceWindowParamsSchema = schema.object({
  data: schema.object({
    title: schema.string(),
    duration: schema.number(),
    rRule: rRuleRequestSchema,
    categoryIds: maintenanceWindowCategoryIdsSchema,
    scopedQuery: schema.maybe(schema.nullable(alertsFilterQuerySchema)),
    enabled: schema.maybe(schema.boolean({ defaultValue: true })),
  }),
});
