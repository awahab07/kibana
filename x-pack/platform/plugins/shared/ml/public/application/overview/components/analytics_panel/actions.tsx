/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React, { useMemo } from 'react';
import { EuiToolTip, EuiButtonIcon } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { Action } from '@elastic/eui/src/components/basic_table/action_types';
import {
  getAnalysisType,
  type DataFrameAnalysisConfigType,
} from '@kbn/ml-data-frame-analytics-utils';
import {
  useMlLink,
  useMlManagementLocatorInternal,
  useNavigateToPath,
} from '../../../contexts/kibana';
import type { DataFrameAnalyticsListRow } from '../../../data_frame_analytics/pages/analytics_management/components/analytics_list/common';
import { getViewLinkStatus } from '../../../data_frame_analytics/pages/analytics_management/components/action_view/get_view_link_status';
import { ML_PAGES } from '../../../../../common/constants/locator';

interface Props {
  item: DataFrameAnalyticsListRow;
}

export const ViewLink: FC<Props> = ({ item }) => {
  const { disabled, tooltipContent } = getViewLinkStatus(item);

  const viewJobResultsButtonText = i18n.translate(
    'xpack.ml.overview.analytics.resultActions.openJobText',
    {
      defaultMessage: 'View job results',
    }
  );

  const tooltipText = disabled === false ? viewJobResultsButtonText : tooltipContent;
  const analysisType = useMemo(() => getAnalysisType(item.config.analysis), [item]);

  const viewAnalyticsResultsLink = useMlLink({
    page: ML_PAGES.DATA_FRAME_ANALYTICS_EXPLORATION,
    pageState: {
      jobId: item.id,
      analysisType: analysisType as DataFrameAnalysisConfigType,
    },
  });

  return (
    <EuiToolTip position="top" content={tooltipText}>
      <EuiButtonIcon
        href={viewAnalyticsResultsLink}
        size="xs"
        iconType="visTable"
        aria-label={viewJobResultsButtonText}
        data-test-subj="mlOverviewAnalyticsJobViewButton"
        isDisabled={disabled}
      />
    </EuiToolTip>
  );
};

export function useTableActions(): Array<Action<DataFrameAnalyticsListRow>> {
  const mlManagementLocator = useMlManagementLocatorInternal();
  const navigateToPath = useNavigateToPath();

  return [
    {
      isPrimary: false,
      name: i18n.translate('xpack.ml.overview.analytics.viewJobActionName', {
        defaultMessage: 'View job',
      }),
      description: i18n.translate('xpack.ml.overview.analytics.viewJobActionName', {
        defaultMessage: 'View job',
      }),
      type: 'icon',
      icon: 'list',
      onClick: async (item) => {
        const { url } = await mlManagementLocator?.getUrl(
          {
            page: ML_PAGES.DATA_FRAME_ANALYTICS_JOBS_MANAGE,
            pageState: {
              jobId: item.id,
            },
          },
          'analytics'
        );
        await navigateToPath(url);
      },
    },
    {
      isPrimary: false,
      name: i18n.translate('xpack.ml.overview.analytics.viewResultsActionName', {
        defaultMessage: 'View results',
      }),
      description: i18n.translate('xpack.ml.overview.analytics.resultActions.openJobText', {
        defaultMessage: 'View job results',
      }),
      render: (item: DataFrameAnalyticsListRow) => <ViewLink item={item} />,
    },
  ];
}
