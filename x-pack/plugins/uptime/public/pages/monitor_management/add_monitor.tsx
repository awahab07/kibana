/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import React from 'react';
import { useLocation } from 'react-use/lib';
import { useFetcher, useTrackPageview } from '../../../../observability/public';
import { DataStream, ScheduleUnit } from '../../../common/runtime_types';
import { SyntheticsProviders } from '../../components/fleet_package/contexts';
import { useLocations } from '../../components/monitor_management/hooks/use_locations';
import { Loader } from '../../components/monitor_management/loader/loader';
import { MonitorConfig } from '../../components/monitor_management/monitor_config/monitor_config';
import { apiService } from '../../state/api/utils';
import { useMonitorManagementBreadcrumbs } from './use_monitor_management_breadcrumbs';

export const AddMonitorPage: React.FC = () => {
  useTrackPageview({ app: 'uptime', path: 'add-monitor' });
  useTrackPageview({ app: 'uptime', path: 'add-monitor', delay: 15000 });

  const { error, loading, locations } = useLocations();

  useMonitorManagementBreadcrumbs({ isAddMonitor: true });

  const { search } = useLocation();
  const rumSessionId = new URLSearchParams(search).get('rumSessionId');

  const { data: browserData, loading: inlineScriptLoading } = useFetcher(() => {
    if (!rumSessionId) {
      return null;
    }

    return apiService.get('/internal/apm/ux/user-session-script', {
      sessionId: rumSessionId,
    });
  }, [rumSessionId]);

  return (
    <Loader
      error={Boolean(error) || (locations && locations.length === 0)}
      loading={loading}
      loadingTitle={LOADING_LABEL}
      errorTitle={ERROR_HEADING_LABEL}
      errorBody={ERROR_BODY_LABEL}
    >
      <SyntheticsProviders
        policyDefaultValues={{
          isZipUrlSourceEnabled: false,
          allowedScheduleUnits: [ScheduleUnit.MINUTES],
          defaultMonitorType: rumSessionId ? DataStream.BROWSER : DataStream.HTTP,
          defaultName: rumSessionId ? `RUM Session ${rumSessionId}` : '',
          defaultInlineScript:
            browserData && rumSessionId && !inlineScriptLoading
              ? (browserData as any)?.inlineScript ?? ''
              : '',
        }}
      >
        <MonitorConfig isEdit={false} />
      </SyntheticsProviders>
    </Loader>
  );
};

const LOADING_LABEL = i18n.translate('xpack.uptime.monitorManagement.addMonitorLoadingLabel', {
  defaultMessage: 'Loading Monitor Management',
});

const ERROR_HEADING_LABEL = i18n.translate(
  'xpack.uptime.monitorManagement.addMonitorLoadingError',
  {
    defaultMessage: 'Error loading monitor management',
  }
);

const ERROR_BODY_LABEL = i18n.translate(
  'xpack.uptime.monitorManagement.addMonitorServiceLocationsLoadingError',
  {
    defaultMessage: 'Service locations were not able to be loaded. Please try again later.',
  }
);
