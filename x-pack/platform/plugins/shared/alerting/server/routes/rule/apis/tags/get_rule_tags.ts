/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { IRouter } from '@kbn/core/server';
import { transformRuleTagsBodyResponseV1 } from './transforms';
import { transformRuleTagsQueryRequestV1 } from './transforms';
import type { RuleTagsRequestQueryV1 } from '../../../../../common/routes/rule/apis/tags';
import { ruleTagsRequestQuerySchemaV1 } from '../../../../../common/routes/rule/apis/tags';
import type { AlertingRequestHandlerContext } from '../../../../types';
import { INTERNAL_BASE_ALERTING_API_PATH } from '../../../../types';
import type { ILicenseState } from '../../../../lib';
import { verifyAccessAndContext } from '../../../lib';
import { DEFAULT_ALERTING_ROUTE_SECURITY } from '../../../constants';

export const getRuleTagsRoute = (
  router: IRouter<AlertingRequestHandlerContext>,
  licenseState: ILicenseState
) => {
  router.get(
    {
      path: `${INTERNAL_BASE_ALERTING_API_PATH}/rules/_tags`,
      security: DEFAULT_ALERTING_ROUTE_SECURITY,
      options: { access: 'internal' },
      validate: {
        query: ruleTagsRequestQuerySchemaV1,
      },
    },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async function (context, req, res) {
        const alertingContext = await context.alerting;
        const rulesClient = await alertingContext.getRulesClient();
        const query: RuleTagsRequestQueryV1 = req.query;

        const options = transformRuleTagsQueryRequestV1(query);

        const tagsResult = await rulesClient.getTags(options);

        return res.ok({
          body: transformRuleTagsBodyResponseV1(tagsResult),
        });
      })
    )
  );
};
