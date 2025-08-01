/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getService }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const ml = getService('ml');

  const jobId = `ec_geo_1_${Date.now()}`;
  const jobIdClone = `${jobId}_clone`;
  const jobDescription = 'Create geo job based on the ecommerce sample dataset with 15m bucketspan';
  const jobGroups = ['automated', 'ecommerce', 'geo'];
  const jobGroupsClone = [...jobGroups, 'clone'];
  const geoField = 'geoip.location';
  const splitField = 'customer_gender';
  const detectors = [
    {
      identifier: 'Lat long(geoip.location)',
      frontCardTitle: "Men's Clothing",
      function: 'lat_long',
      field_name: geoField,
      numberOfBackCards: 5,
      splitField,
    },
  ];
  const bucketSpan = '15m';
  const memoryLimit = '8mb';

  function getExpectedRow(expectedJobId: string, expectedJobGroups: string[]) {
    return {
      id: expectedJobId,
      description: jobDescription,
      jobGroups: [...new Set(expectedJobGroups)].sort(),
      recordCount: '4,675',
      memoryStatus: 'ok',
      jobState: 'closed',
      datafeedState: 'stopped',
      latestTimestamp: '2023-07-12 23:45:36',
    };
  }

  function getExpectedCounts(expectedJobId: string) {
    return {
      job_id: expectedJobId,
      processed_record_count: '4,675',
      processed_field_count: '9,350',
      input_bytes: '504.1 KB',
      input_field_count: '9,350',
      invalid_date_count: '0',
      missing_field_count: '0',
      out_of_order_timestamp_count: '0',
      empty_bucket_count: '492',
      sparse_bucket_count: '0',
      bucket_count: '2,975',
      earliest_record_timestamp: '2023-06-12 00:04:19',
      latest_record_timestamp: '2023-07-12 23:45:36',
      input_record_count: '4,675',
      latest_bucket_timestamp: '2023-07-12 23:45:00',
    };
  }

  function getExpectedModelSizeStats(expectedJobId: string) {
    return {
      job_id: expectedJobId,
      result_type: 'model_size_stats',
      model_bytes_exceeded: '0.0 B',
      total_by_field_count: '4',
      total_over_field_count: '0',
      total_partition_field_count: '3',
      bucket_allocation_failures_count: '0',
      memory_status: 'ok',
      timestamp: '2023-07-12 23:30:00',
    };
  }

  const calendarId = `wizard-test-calendar_${Date.now()}`;

  describe('geo', function () {
    this.tags(['ml']);
    before(async () => {
      await esArchiver.loadIfNeeded('x-pack/platform/test/fixtures/es_archives/ml/ecommerce');
      await ml.testResources.createDataViewIfNeeded('ft_ecommerce', 'order_date');
      await ml.testResources.setKibanaTimeZoneToUTC();

      await ml.api.createCalendar(calendarId);
      await ml.securityUI.loginAsMlPowerUser();
    });

    after(async () => {
      await ml.api.cleanMlIndices();
      await ml.testResources.deleteDataViewByTitle('ft_ecommerce');
    });

    it('job creation loads the geo wizard for the source data', async () => {
      await ml.testExecution.logTestStep('job creation loads the job management page');
      await ml.navigation.navigateToStackManagementMlSection('anomaly_detection', 'ml-jobs-list');

      await ml.testExecution.logTestStep('job creation loads the new job source selection page');
      await ml.jobManagement.navigateToNewJobSourceSelection();

      await ml.testExecution.logTestStep('job creation loads the job type selection page');
      await ml.jobSourceSelection.selectSourceForAnomalyDetectionJob('ft_ecommerce');

      await ml.testExecution.logTestStep('job creation loads the geo job wizard page');
      await ml.jobTypeSelection.selectGeoJob();
    });

    it('job creation navigates through the geo wizard and sets all needed fields', async () => {
      await ml.testExecution.logTestStep('job creation displays the time range step');
      await ml.jobWizardCommon.assertTimeRangeSectionExists();

      await ml.testExecution.logTestStep('job creation sets the time range');
      await ml.jobWizardCommon.clickUseFullDataButton(
        'Jun 12, 2023 @ 00:04:19.000',
        'Jul 12, 2023 @ 23:45:36.000'
      );

      await ml.testExecution.logTestStep('job creation displays the event rate chart');
      await ml.jobWizardCommon.assertEventRateChartExists();
      await ml.jobWizardCommon.assertEventRateChartHasData();

      await ml.testExecution.logTestStep('job creation displays the pick fields step');
      await ml.jobWizardCommon.advanceToPickFieldsSection();

      await ml.testExecution.logTestStep('job creation selects the geo field');
      await ml.jobWizardGeo.assertGeoFieldInputExists();
      await ml.jobWizardGeo.selectGeoField(geoField);

      await ml.testExecution.logTestStep('job creation displays detector preview');

      await ml.jobWizardGeo.assertDetectorPreviewExists(detectors[0].identifier);

      await ml.testExecution.logTestStep(
        'job creation inputs the split field and displays split cards'
      );

      await ml.jobWizardMultiMetric.assertSplitFieldInputExists();
      await ml.jobWizardMultiMetric.selectSplitField(splitField);

      await ml.jobWizardMultiMetric.assertDetectorSplitExists(splitField);
      await ml.jobWizardMultiMetric.assertDetectorSplitFrontCardTitle('FEMALE');
      await ml.jobWizardMultiMetric.assertDetectorSplitNumberOfBackCards(1);

      await ml.testExecution.logTestStep('job creation displays the influencer field');
      await ml.jobWizardCommon.assertInfluencerInputExists();
      await ml.jobWizardCommon.assertInfluencerSelection([splitField]);

      await ml.testExecution.logTestStep('job creation inputs the bucket span');
      await ml.jobWizardCommon.assertBucketSpanInputExists();
      await ml.jobWizardCommon.setBucketSpan(bucketSpan);

      await ml.testExecution.logTestStep('job creation displays the job details step');
      await ml.jobWizardCommon.advanceToJobDetailsSection();

      await ml.testExecution.logTestStep('job creation inputs the job id');
      await ml.jobWizardCommon.assertJobIdInputExists();
      await ml.jobWizardCommon.setJobId(jobId);

      await ml.testExecution.logTestStep('job creation inputs the job description');
      await ml.jobWizardCommon.assertJobDescriptionInputExists();
      await ml.jobWizardCommon.setJobDescription(jobDescription);

      await ml.testExecution.logTestStep('job creation inputs job groups');
      await ml.jobWizardCommon.assertJobGroupInputExists();
      for (const jobGroup of jobGroups) {
        await ml.jobWizardCommon.addJobGroup(jobGroup);
      }
      await ml.jobWizardCommon.assertJobGroupSelection(jobGroups);

      await ml.testExecution.logTestStep('job creation opens the additional settings section');
      await ml.jobWizardCommon.ensureAdditionalSettingsSectionOpen();

      await ml.testExecution.logTestStep('job creation adds a new custom url');
      await ml.jobWizardCommon.addCustomUrl({ label: 'check-kibana-dashboard' });

      await ml.testExecution.logTestStep('job creation assigns calendars');
      await ml.jobWizardCommon.addCalendar(calendarId);

      await ml.testExecution.logTestStep('job creation opens the advanced section');
      await ml.jobWizardCommon.ensureAdvancedSectionOpen();

      await ml.testExecution.logTestStep('job creation displays the model plot switch');
      await ml.jobWizardCommon.assertModelPlotSwitchExists();

      await ml.testExecution.logTestStep('job creation enables the dedicated index switch');
      await ml.jobWizardCommon.assertDedicatedIndexSwitchExists();
      await ml.jobWizardCommon.activateDedicatedIndexSwitch();

      await ml.testExecution.logTestStep('job creation inputs the model memory limit');
      await ml.jobWizardCommon.assertModelMemoryLimitInputExists();
      await ml.jobWizardCommon.setModelMemoryLimit(memoryLimit);

      await ml.testExecution.logTestStep('job creation displays the validation step');
      await ml.jobWizardCommon.advanceToValidationSection();

      await ml.testExecution.logTestStep('job creation displays the summary step');
      await ml.jobWizardCommon.advanceToSummarySection();
    });

    it('job creation runs the job and displays it correctly in the job list', async () => {
      await ml.testExecution.logTestStep('job creation creates the job and finishes processing');
      await ml.jobWizardCommon.assertCreateJobButtonExists();
      await ml.jobWizardCommon.createJobAndWaitForCompletion();

      await ml.testExecution.logTestStep('job creation displays the created job in the job list');
      await ml.navigation.navigateToStackManagementMlSection('anomaly_detection', 'ml-jobs-list');

      await ml.jobTable.filterWithSearchString(jobId, 1);

      await ml.testExecution.logTestStep(
        'job creation displays details for the created job in the job list'
      );
      await ml.jobTable.assertJobRowFields(jobId, getExpectedRow(jobId, jobGroups));

      await ml.jobExpandedDetails.assertJobRowDetailsCounts(
        jobId,
        getExpectedCounts(jobId),
        getExpectedModelSizeStats(jobId)
      );

      await ml.testExecution.logTestStep('job creation has detector results');
      for (let i = 0; i < detectors.length; i++) {
        await ml.api.assertDetectorResultsExist(jobId, i);
      }
    });

    it('job cloning opens the existing job in the geo wizard', async () => {
      await ml.testExecution.logTestStep(
        'job cloning clicks the clone action and loads the geo wizard'
      );
      await ml.jobTable.clickCloneJobAction(jobId);
      await ml.jobTypeSelection.assertGeoJobWizardOpen();
    });

    it('job cloning navigates through the geo wizard, checks and sets all needed fields', async () => {
      await ml.testExecution.logTestStep('job cloning displays the time range step');
      await ml.jobWizardCommon.assertTimeRangeSectionExists();

      await ml.testExecution.logTestStep('job cloning sets the time range');
      await ml.jobWizardCommon.clickUseFullDataButton(
        'Jun 12, 2023 @ 00:04:19.000',
        'Jul 12, 2023 @ 23:45:36.000'
      );

      await ml.testExecution.logTestStep('job cloning displays the event rate chart');
      await ml.jobWizardCommon.assertEventRateChartExists();
      await ml.jobWizardCommon.assertEventRateChartHasData();

      await ml.testExecution.logTestStep('job cloning displays the pick fields step');
      await ml.jobWizardCommon.advanceToPickFieldsSection();

      await ml.testExecution.logTestStep('job cloning pre-fills the geo field');
      await ml.jobWizardGeo.assertGeoFieldInputExists();
      await ml.jobWizardGeo.assertGeoFieldSelection([geoField]);

      await ml.testExecution.logTestStep(
        'job cloning displays the detector preview with pre-filled geo field'
      );
      await ml.jobWizardGeo.assertDetectorPreviewExists(detectors[0].identifier);

      await ml.testExecution.logTestStep('job cloning pre-fills influencers');
      await ml.jobWizardCommon.assertInfluencerInputExists();
      await ml.jobWizardCommon.assertInfluencerSelection([splitField]);

      await ml.testExecution.logTestStep('job cloning pre-fills the bucket span');
      await ml.jobWizardCommon.assertBucketSpanInputExists();
      await ml.jobWizardCommon.assertBucketSpanValue(bucketSpan);

      await ml.testExecution.logTestStep('job cloning displays the job details step');
      await ml.jobWizardCommon.advanceToJobDetailsSection();

      await ml.testExecution.logTestStep('job cloning does not pre-fill the job id');
      await ml.jobWizardCommon.assertJobIdInputExists();
      await ml.jobWizardCommon.assertJobIdValue('');

      await ml.testExecution.logTestStep('job cloning inputs the clone job id');
      await ml.jobWizardCommon.setJobId(jobIdClone);

      await ml.testExecution.logTestStep('job cloning pre-fills the job description');
      await ml.jobWizardCommon.assertJobDescriptionInputExists();
      await ml.jobWizardCommon.assertJobDescriptionValue(jobDescription);

      await ml.testExecution.logTestStep('job cloning pre-fills job groups');
      await ml.jobWizardCommon.assertJobGroupInputExists();
      await ml.jobWizardCommon.assertJobGroupSelection(jobGroups);

      await ml.testExecution.logTestStep('job cloning inputs the clone job group');
      await ml.jobWizardCommon.assertJobGroupInputExists();
      await ml.jobWizardCommon.addJobGroup('clone');
      await ml.jobWizardCommon.assertJobGroupSelection(jobGroupsClone);

      await ml.testExecution.logTestStep('job cloning opens the additional settings section');
      await ml.jobWizardCommon.ensureAdditionalSettingsSectionOpen();

      await ml.testExecution.logTestStep('job cloning persists custom urls');
      await ml.customUrls.assertCustomUrlLabel(0, 'check-kibana-dashboard');

      await ml.testExecution.logTestStep('job cloning persists assigned calendars');
      await ml.jobWizardCommon.assertCalendarsSelection([calendarId]);

      await ml.testExecution.logTestStep('job cloning opens the advanced section');
      await ml.jobWizardCommon.ensureAdvancedSectionOpen();

      await ml.testExecution.logTestStep('job cloning pre-fills the model plot switch');
      await ml.jobWizardCommon.assertModelPlotSwitchExists();
      await ml.jobWizardCommon.assertModelPlotSwitchCheckedState(false);

      await ml.testExecution.logTestStep('job cloning pre-fills the dedicated index switch');
      await ml.jobWizardCommon.assertDedicatedIndexSwitchExists();
      await ml.jobWizardCommon.assertDedicatedIndexSwitchCheckedState(true);

      await ml.testExecution.logTestStep('job cloning displays the validation step');
      await ml.jobWizardCommon.advanceToValidationSection();

      await ml.testExecution.logTestStep('job cloning displays the summary step');
      await ml.jobWizardCommon.advanceToSummarySection();
    });

    it('job cloning runs the clone job and displays it correctly in the job list', async () => {
      await ml.testExecution.logTestStep('job cloning creates the job and finishes processing');
      await ml.jobWizardCommon.assertCreateJobButtonExists();
      await ml.jobWizardCommon.createJobAndWaitForCompletion();

      await ml.testExecution.logTestStep('job cloning displays the created job in the job list');
      await ml.navigation.navigateToStackManagementMlSection('anomaly_detection', 'ml-jobs-list');

      await ml.jobTable.filterWithSearchString(jobIdClone, 1);

      await ml.testExecution.logTestStep(
        'job cloning displays details for the created job in the job list'
      );
      await ml.jobTable.assertJobRowFields(jobIdClone, getExpectedRow(jobIdClone, jobGroupsClone));

      await ml.jobExpandedDetails.assertJobRowDetailsCounts(
        jobIdClone,
        getExpectedCounts(jobIdClone),
        getExpectedModelSizeStats(jobIdClone)
      );

      await ml.testExecution.logTestStep('job cloning has detector results');
      for (let i = 0; i < detectors.length; i++) {
        await ml.api.assertDetectorResultsExist(jobId, i);
      }
    });
  });
}
