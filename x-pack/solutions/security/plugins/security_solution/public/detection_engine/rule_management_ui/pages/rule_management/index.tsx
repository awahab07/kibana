/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiSpacer, EuiToolTip } from '@elastic/eui';
import { MaintenanceWindowCallout } from '@kbn/alerts-ui-shared';
import { DEFAULT_APP_CATEGORIES } from '@kbn/core-application-common';
import { APP_UI_ID } from '../../../../../common/constants';
import { SecurityPageName } from '../../../../app/types';
import { SecuritySolutionLinkButton } from '../../../../common/components/links';
import { getDetectionEngineUrl } from '../../../../common/components/link_to/redirect_to_detection_engine';
import { SecuritySolutionPageWrapper } from '../../../../common/components/page_wrapper';
import { useBoolState } from '../../../../common/hooks/use_bool_state';
import { useKibana } from '../../../../common/lib/kibana';
import { hasUserCRUDPermission } from '../../../../common/utils/privileges';
import { SpyRoute } from '../../../../common/utils/route/spy_routes';
import { MissingPrivilegesCallOut } from '../../../../detections/components/callouts/missing_privileges_callout';
import { MlJobCompatibilityCallout } from '../../components/ml_job_compatibility_callout';
import { NeedAdminForUpdateRulesCallOut } from '../../../../detections/components/callouts/need_admin_for_update_callout';
import { AddElasticRulesButton } from '../../components/pre_packaged_rules/add_elastic_rules_button';
import { ValueListsFlyout } from '../../../../detections/components/value_lists_management_flyout';
import { useUserData } from '../../../../detections/components/user_info';
import { useListsConfig } from '../../../../detections/containers/detection_engine/lists/use_lists_config';
import { redirectToDetections } from '../../../common/helpers';
import * as i18n from '../../../common/translations';
import { AllRules } from '../../components/rules_table';
import { RulesTableContextProvider } from '../../components/rules_table/rules_table/rules_table_context';
import { HeaderPage } from '../../../../common/components/header_page';
import { RuleUpdateCallouts } from '../../components/rule_update_callouts/rule_update_callouts';
import { BlogPostPrebuiltRuleCustomizationCallout } from '../../components/blog_post_prebuilt_rule_customization_callout';
import { RuleImportModal } from '../../components/rule_import_modal/rule_import_modal';

const RulesPageComponent: React.FC = () => {
  const [isImportModalVisible, showImportModal, hideImportModal] = useBoolState();
  const [isValueListFlyoutVisible, showValueListFlyout, hideValueListFlyout] = useBoolState();
  const kibanaServices = useKibana().services;
  const { navigateToApp } = kibanaServices.application;

  const [
    {
      loading: userInfoLoading,
      isSignalIndexExists,
      isAuthenticated,
      hasEncryptionKey,
      canUserCRUD,
    },
  ] = useUserData();
  const {
    loading: listsConfigLoading,
    canWriteIndex: canWriteListsIndex,
    canCreateIndex: canCreateListsIndex,
    needsConfiguration: needsListsConfiguration,
    needsIndex: needsListsIndex,
  } = useListsConfig();
  const loading = userInfoLoading || listsConfigLoading;

  if (
    redirectToDetections(
      isSignalIndexExists,
      isAuthenticated,
      hasEncryptionKey,
      needsListsConfiguration
    )
  ) {
    navigateToApp(APP_UI_ID, {
      deepLinkId: SecurityPageName.alerts,
      path: getDetectionEngineUrl(),
    });
    return null;
  }

  // - if lists data stream does not exist and user doesn't have enough privileges to create it,
  // lists button should be disabled
  // - if data stream exists and user doesn't have enough privileges to create it,
  // user still can import value lists, so button should not be disabled if user has enough other privileges
  const cantCreateNonExistentListIndex = needsListsIndex && !canCreateListsIndex;
  const isImportValueListDisabled =
    cantCreateNonExistentListIndex || !canWriteListsIndex || !canUserCRUD || loading;

  return (
    <>
      <NeedAdminForUpdateRulesCallOut />
      <MissingPrivilegesCallOut />
      <MlJobCompatibilityCallout />
      <ValueListsFlyout showFlyout={isValueListFlyoutVisible} onClose={hideValueListFlyout} />
      <RuleImportModal
        isImportModalVisible={isImportModalVisible}
        hideImportModal={hideImportModal}
      />

      <RulesTableContextProvider>
        <SecuritySolutionPageWrapper>
          <HeaderPage title={i18n.PAGE_TITLE}>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap={true}>
              <EuiFlexItem grow={false}>
                <AddElasticRulesButton isDisabled={!canUserCRUD || loading} />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiToolTip
                  position="top"
                  content={
                    cantCreateNonExistentListIndex
                      ? i18n.UPLOAD_VALUE_LISTS_PRIVILEGES_TOOLTIP
                      : i18n.UPLOAD_VALUE_LISTS_TOOLTIP
                  }
                >
                  <EuiButtonEmpty
                    data-test-subj="open-value-lists-modal-button"
                    iconType="importAction"
                    isDisabled={isImportValueListDisabled}
                    onClick={showValueListFlyout}
                  >
                    {i18n.IMPORT_VALUE_LISTS}
                  </EuiButtonEmpty>
                </EuiToolTip>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  data-test-subj="rules-import-modal-button"
                  iconType="importAction"
                  isDisabled={!hasUserCRUDPermission(canUserCRUD) || loading}
                  onClick={showImportModal}
                >
                  {i18n.IMPORT_RULE}
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <SecuritySolutionLinkButton
                  data-test-subj="create-new-rule"
                  fill
                  iconType="plusInCircle"
                  isDisabled={!hasUserCRUDPermission(canUserCRUD) || loading}
                  deepLinkId={SecurityPageName.rulesCreate}
                >
                  {i18n.ADD_NEW_RULE}
                </SecuritySolutionLinkButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </HeaderPage>
          <RuleUpdateCallouts shouldShowUpdateRulesCallout={true} />
          <EuiSpacer size="s" />
          <MaintenanceWindowCallout
            kibanaServices={kibanaServices}
            categories={[DEFAULT_APP_CATEGORIES.security.id]}
          />
          <BlogPostPrebuiltRuleCustomizationCallout />
          <AllRules data-test-subj="all-rules" />
        </SecuritySolutionPageWrapper>
      </RulesTableContextProvider>

      <SpyRoute pageName={SecurityPageName.rules} />
    </>
  );
};

export const RulesPage = React.memo(RulesPageComponent);
