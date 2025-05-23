/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

export const READ_ONLY_BADGE_TOOLTIP = i18n.translate(
  'xpack.securitySolution.alerts.badge.readOnly.tooltip',
  {
    defaultMessage: 'Unable to update alerts',
  }
);

export const PAGE_TITLE = i18n.translate(
  'xpack.securitySolution.detectionEngine.detectionsPageTitle',
  {
    defaultMessage: 'Alerts',
  }
);

export const BUTTON_MANAGE_RULES = i18n.translate(
  'xpack.securitySolution.detectionEngine.buttonManageRules',
  {
    defaultMessage: 'Manage rules',
  }
);

export const GO_TO_DOCUMENTATION = i18n.translate(
  'xpack.securitySolution.detectionEngine.goToDocumentationButton',
  {
    defaultMessage: 'View documentation',
  }
);

export const USER_UNAUTHENTICATED_MSG_BODY = i18n.translate(
  'xpack.securitySolution.detectionEngine.userUnauthenticatedMsgBody',
  {
    defaultMessage:
      'You do not have the required permissions for viewing the detection engine. For more help, contact your administrator.',
  }
);

export const USER_UNAUTHENTICATED_TITLE = i18n.translate(
  'xpack.securitySolution.detectionEngine.userUnauthenticatedTitle',
  {
    defaultMessage: 'Detection engine permissions required',
  }
);

export const NEEDS_INDEX_PERMISSIONS = (additionalContext: string) =>
  i18n.translate('xpack.securitySolution.detectionEngine.needsIndexPermissionsMessage', {
    values: { additionalContext },
    defaultMessage:
      'To use the detection engine, a user with the required cluster and index privileges must first access this page. {additionalContext} For more help, contact your Elastic Stack administrator.',
  });

export const NEEDS_SIGNALS_AND_LISTS_INDEXES = i18n.translate(
  'xpack.securitySolution.detectionEngine.needsSignalsAndListsIndexesMessage',
  {
    defaultMessage: 'You need permissions for the signals and lists indices.',
  }
);

export const NEEDS_SIGNALS_INDEX = i18n.translate(
  'xpack.securitySolution.detectionEngine.needsSignalsIndexMessage',
  {
    defaultMessage: 'You need permissions for the signals index.',
  }
);

export const NEEDS_LISTS_INDEXES = i18n.translate(
  'xpack.securitySolution.detectionEngine.needsListsIndexesMessage',
  {
    defaultMessage: 'You need permissions for the lists indices.',
  }
);

export const NO_INDEX_TITLE = i18n.translate(
  'xpack.securitySolution.detectionEngine.noIndexTitle',
  {
    defaultMessage: 'Let’s set up your detection engine',
  }
);
