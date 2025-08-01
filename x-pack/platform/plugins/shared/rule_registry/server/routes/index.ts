/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IRouter } from '@kbn/core/server';
import { getAlertsGroupAggregations } from './get_alerts_group_aggregations';
import type { RacRequestHandlerContext } from '../types';
import { getAlertByIdRoute } from './get_alert_by_id';
import { updateAlertByIdRoute } from './update_alert_by_id';
import { getAlertsIndexRoute } from './get_alert_index';
import { bulkUpdateAlertsRoute } from './bulk_update_alerts';
import { findAlertsByQueryRoute } from './find';
import { getBrowserFieldsByFeatureId } from './get_browser_fields_by_rule_type_ids';
import { getAlertSummaryRoute } from './get_alert_summary';
import { getAlertFieldsByRuleTypeIds } from './get_alert_fields/get_alert_fields_by_rule_type_ids';

export function defineRoutes(router: IRouter<RacRequestHandlerContext>) {
  getAlertByIdRoute(router);
  updateAlertByIdRoute(router);
  getAlertsIndexRoute(router);
  bulkUpdateAlertsRoute(router);
  findAlertsByQueryRoute(router);
  getAlertsGroupAggregations(router);
  getBrowserFieldsByFeatureId(router);
  getAlertFieldsByRuleTypeIds(router);
  getAlertSummaryRoute(router);
}
