/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { RULE_SAVED_OBJECT_TYPE } from '@kbn/alerting-plugin/server';
import expect from '@kbn/expect';
import { omit } from 'lodash';
import { FtrProviderContext } from '../../ftr_provider_context';
import type { InternalRequestHeader, RoleCredentials } from '../../../shared/services';

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const esClient = getService('es');
  const esDeleteAllIndices = getService('esDeleteAllIndices');
  const svlCommonApi = getService('svlCommonApi');
  const svlUserManager = getService('svlUserManager');
  const alertingApi = getService('alertingApi');

  let roleAdmin: RoleCredentials;
  let internalReqHeader: InternalRequestHeader;

  describe('Alerting rules', function () {
    // Timeout of 360000ms exceeded
    this.tags(['failsOnMKI']);
    const RULE_TYPE_ID = '.es-query';
    const ALERT_ACTION_INDEX = 'alert-action-es-query';
    let connectorId: string;
    let ruleId: string;

    before(async () => {
      roleAdmin = await svlUserManager.createM2mApiKeyWithRoleScope('admin');
      internalReqHeader = svlCommonApi.getInternalRequestHeader();
    });
    after(async () => {
      await svlUserManager.invalidateM2mApiKeyWithRoleScope(roleAdmin);
    });

    afterEach(async () => {
      await supertest.delete(`/api/actions/connector/${connectorId}`).set(internalReqHeader);
      await supertest.delete(`/api/alerting/rule/${ruleId}`).set(internalReqHeader);
      await esClient.deleteByQuery({
        index: '.kibana-event-log-*',
        conflicts: 'proceed',
        query: { term: { 'kibana.alert.rule.consumer': 'alerts' } },
      });
      await esDeleteAllIndices([ALERT_ACTION_INDEX]);
    });

    it('should schedule task, run rule and schedule actions when appropriate', async () => {
      const testStart = new Date();

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onActiveAlert',
              throttle: null,
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      // Wait for the action to index a document before disabling the alert and waiting for tasks to finish
      const resp = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
        retryOptions: {
          retryCount: 12,
          retryDelay: 2000,
        },
      });
      expect(resp.hits.hits.length).to.be(1);

      const document = resp.hits.hits[0];
      expect(omit(document, '_source.date')._source).to.eql({
        alertActionGroup: 'query matched',
        alertId: 'query matched',
        instanceContextValue: '',
        instanceStateValue: '',
        ruleId,
        ruleName: 'always fire',
        ruleParams:
          '{"size":100,"thresholdComparator":">","threshold":[-1],"index":["alert-test-data"],"timeField":"date","esQuery":"{\\n  \\"query\\":{\\n    \\"match_all\\" : {}\\n  }\\n}","timeWindowSize":20,"timeWindowUnit":"s","excludeHitsFromPreviousRun":true,"aggType":"count","groupBy":"all","searchType":"esQuery"}',
        spaceId: 'default',
        tags: '',
      });

      const eventLogResp = await alertingApi.helpers.waiting.waitForExecutionEventLog({
        esClient,
        filter: testStart,
        ruleId,
      });
      expect(eventLogResp.hits.hits.length).to.be(1);

      const eventLogDocument = eventLogResp.hits.hits[0]._source;
      validateEventLog(eventLogDocument, {
        ruleId,
        ruleTypeId: RULE_TYPE_ID,
        outcome: 'success',
        name: 'always fire',
        message: `rule executed: ${RULE_TYPE_ID}:${ruleId}: 'always fire'`,
      });
    });

    it('should pass updated rule params to executor', async () => {
      const testStart = new Date();

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onActiveAlert',
              throttle: null,
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      // Wait for the action to index a document before disabling the alert and waiting for tasks to finish
      const resp = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
        retryOptions: { retryDelay: 800, retryCount: 10 },
      });
      expect(resp.hits.hits.length).to.be(1);

      const document = resp.hits.hits[0];
      expect(omit(document, '_source.date')._source).to.eql({
        alertActionGroup: 'query matched',
        alertId: 'query matched',
        instanceContextValue: '',
        instanceStateValue: '',
        ruleId,
        ruleName: 'always fire',
        ruleParams:
          '{"size":100,"thresholdComparator":">","threshold":[-1],"index":["alert-test-data"],"timeField":"date","esQuery":"{\\n  \\"query\\":{\\n    \\"match_all\\" : {}\\n  }\\n}","timeWindowSize":20,"timeWindowUnit":"s","excludeHitsFromPreviousRun":true,"aggType":"count","groupBy":"all","searchType":"esQuery"}',
        spaceId: 'default',
        tags: '',
      });

      await alertingApi.helpers.waiting.waitForAllTasksIdle({
        esClient,
        filter: testStart,
      });

      await alertingApi.helpers.updateEsQueryRule({
        roleAuthc: roleAdmin,
        ruleId,
        updates: {
          name: 'def',
          tags: ['fee', 'fi', 'fo'],
        },
      });

      await alertingApi.helpers.runRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      // make sure alert info passed to executor is correct
      const resp2 = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
        num: 2,
      });
      expect(resp2.hits.hits.length).to.be(2);

      const document2 = resp2.hits.hits[0];
      expect(omit(document2, '_source.date')._source).to.eql({
        alertActionGroup: 'query matched',
        alertId: 'query matched',
        instanceContextValue: '',
        instanceStateValue: '',
        ruleId,
        ruleName: 'def',
        ruleParams:
          '{"size":100,"thresholdComparator":">","threshold":[-1],"index":["alert-test-data"],"timeField":"date","esQuery":"{\\n  \\"query\\":{\\n    \\"match_all\\" : {}\\n  }\\n}","timeWindowSize":20,"timeWindowUnit":"s","excludeHitsFromPreviousRun":true,"aggType":"count","groupBy":"all","searchType":"esQuery"}',
        spaceId: 'default',
        tags: 'fee,fi,fo',
      });
    });

    it('should retry when appropriate', async () => {
      const testStart = new Date();

      // Should fail
      const createdConnector = await alertingApi.helpers.createSlackConnector({
        roleAuthc: roleAdmin,
        name: 'Slack Connector: Alerting API test',
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              message: `message: {{rule.id}}`,
            },
            frequency: {
              notify_when: 'onActiveAlert',
              throttle: null,
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      // Should retry when the the action fails
      const resp = await alertingApi.helpers.waiting.waitForAllTasks({
        esClient,
        filter: testStart,
        taskType: 'actions:.slack',
        attempts: 1,
      });
      expect(resp.hits.hits.length).to.be(1);
    });

    it('should throttle alerts when appropriate', async () => {
      const testStart = new Date();

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        schedule: { interval: '1m' },
        notifyWhen: 'onThrottleInterval',
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
          },
        ],
      });
      ruleId = createdRule.id;

      // Wait until alerts ran at least 3 times before disabling the alert and waiting for tasks to finish
      await alertingApi.helpers.waitForNumRuleRuns({
        roleAuthc: roleAdmin,
        numOfRuns: 3,
        ruleId,
        esClient,
        testStart,
      });

      await alertingApi.helpers.disableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.waiting.waitForDisabled({
        esClient,
        ruleId,
        filter: testStart,
      });

      // Ensure actions only executed once
      const resp = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
      });
      expect(resp.hits.hits.length).to.be(1);
    });

    it('should throttle alerts with throttled action when appropriate', async () => {
      const testStart = new Date();

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        schedule: { interval: '1m' },
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onThrottleInterval',
              throttle: '5m',
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      // Wait until alerts ran at least 3 times before disabling the alert and waiting for tasks to finish
      await alertingApi.helpers.waitForNumRuleRuns({
        roleAuthc: roleAdmin,
        numOfRuns: 3,
        ruleId,
        esClient,
        testStart,
      });

      await alertingApi.helpers.disableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.waiting.waitForDisabled({
        esClient,
        ruleId,
        filter: testStart,
      });

      // Ensure actions only executed once
      const resp = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
      });
      expect(resp.hits.hits.length).to.be(1);
    });

    it('should reset throttle window when not firing and should not throttle when changing groups', async () => {
      const testStart = new Date();

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        schedule: { interval: '1m' },
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onThrottleInterval',
              throttle: '1m',
              summary: false,
            },
          },
          {
            group: 'recovered',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onThrottleInterval',
              throttle: '1m',
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      // Wait for the action to index a document
      const resp = await alertingApi.helpers.waiting.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
      });
      expect(resp.hits.hits.length).to.be(1);

      await alertingApi.helpers.waiting.waitForAllTasksIdle({
        esClient,
        filter: testStart,
      });

      // Update the rule to recover
      await alertingApi.helpers.updateEsQueryRule({
        roleAuthc: roleAdmin,
        ruleId,
        updates: {
          name: 'never fire',
          params: {
            size: 100,
            thresholdComparator: '<',
            threshold: [-1],
            index: ['alert-test-data'],
            timeField: 'date',
            esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
            timeWindowSize: 20,
            timeWindowUnit: 's',
          },
        },
      });

      await alertingApi.helpers.runRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      const eventLogResp = await alertingApi.helpers.waiting.waitForExecutionEventLog({
        esClient,
        filter: testStart,
        ruleId,
        num: 2,
        retryOptions: {
          retryCount: 12,
          retryDelay: 2000,
        },
      });
      expect(eventLogResp.hits.hits.length).to.be(2);

      await alertingApi.helpers.disableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.waiting.waitForDisabled({
        esClient,
        ruleId,
        filter: testStart,
      });

      // Ensure only 2 actions are executed
      const resp2 = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
        num: 2,
      });
      expect(resp2.hits.hits.length).to.be(2);
    });

    it(`shouldn't schedule actions when alert is muted`, async () => {
      const testStart = new Date();
      await alertingApi.helpers.waiting.createIndex({ esClient, indexName: ALERT_ACTION_INDEX });

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        enabled: false,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onActiveAlert',
              throttle: null,
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      await alertingApi.helpers.muteRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.enableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      // Wait until alerts schedule actions twice to ensure actions had a chance to skip
      // execution once before disabling the alert and waiting for tasks to finish
      await alertingApi.helpers.waitForNumRuleRuns({
        roleAuthc: roleAdmin,
        numOfRuns: 2,
        ruleId,
        esClient,
        testStart,
      });

      await alertingApi.helpers.disableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.waiting.waitForDisabled({
        esClient,
        ruleId,
        filter: testStart,
      });

      // Should not have executed any action
      const resp2 = await alertingApi.helpers.waiting.getDocumentsInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
      });
      expect(resp2.hits.hits.length).to.be(0);
    });

    it(`shouldn't schedule actions when alert instance is muted`, async () => {
      const testStart = new Date();
      await alertingApi.helpers.waiting.createIndex({ esClient, indexName: ALERT_ACTION_INDEX });

      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        enabled: false,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onActiveAlert',
              throttle: null,
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      await alertingApi.helpers.muteAlert({
        roleAuthc: roleAdmin,
        ruleId,
        alertId: 'query matched',
      });

      await alertingApi.helpers.enableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      // Wait until alerts schedule actions twice to ensure actions had a chance to skip
      // execution once before disabling the alert and waiting for tasks to finish
      await alertingApi.helpers.waitForNumRuleRuns({
        roleAuthc: roleAdmin,
        numOfRuns: 2,
        ruleId,
        esClient,
        testStart,
      });

      await alertingApi.helpers.disableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.waiting.waitForDisabled({
        esClient,
        ruleId,
        filter: testStart,
      });

      // Should not have executed any action
      const resp2 = await alertingApi.helpers.waiting.getDocumentsInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
      });
      expect(resp2.hits.hits.length).to.be(0);
    });

    it(`should unmute all instances when unmuting an alert`, async () => {
      const createdConnector = await alertingApi.helpers.createIndexConnector({
        roleAuthc: roleAdmin,
        name: 'Index Connector: Alerting API test',
        indexName: ALERT_ACTION_INDEX,
      });
      connectorId = createdConnector.id;

      const createdRule = await alertingApi.helpers.createEsQueryRule({
        roleAuthc: roleAdmin,
        enabled: false,
        consumer: 'alerts',
        name: 'always fire',
        ruleTypeId: RULE_TYPE_ID,
        params: {
          size: 100,
          thresholdComparator: '>',
          threshold: [-1],
          index: ['alert-test-data'],
          timeField: 'date',
          esQuery: `{\n  \"query\":{\n    \"match_all\" : {}\n  }\n}`,
          timeWindowSize: 20,
          timeWindowUnit: 's',
        },
        actions: [
          {
            group: 'query matched',
            id: connectorId,
            params: {
              documents: [
                {
                  ruleId: '{{rule.id}}',
                  ruleName: '{{rule.name}}',
                  ruleParams: '{{rule.params}}',
                  spaceId: '{{rule.spaceId}}',
                  tags: '{{rule.tags}}',
                  alertId: '{{alert.id}}',
                  alertActionGroup: '{{alert.actionGroup}}',
                  instanceContextValue: '{{context.instanceContextValue}}',
                  instanceStateValue: '{{state.instanceStateValue}}',
                  date: '{{date}}',
                },
              ],
            },
            frequency: {
              notify_when: 'onActiveAlert',
              throttle: null,
              summary: false,
            },
          },
        ],
      });
      ruleId = createdRule.id;

      await alertingApi.helpers.muteAlert({
        roleAuthc: roleAdmin,
        ruleId,
        alertId: 'query matched',
      });

      await alertingApi.helpers.muteRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.unmuteRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      await alertingApi.helpers.enableRule({
        roleAuthc: roleAdmin,
        ruleId,
      });

      // Should have one document indexed by the action
      const resp = await alertingApi.helpers.waitForDocumentInIndex({
        esClient,
        indexName: ALERT_ACTION_INDEX,
        ruleId,
      });
      expect(resp.hits.hits.length).to.be(1);
    });
  });
}

interface ValidateEventLogParams {
  ruleId: string;
  ruleTypeId: string;
  outcome: string;
  name: string;
  message: string;
  errorMessage?: string;
}

function validateEventLog(event: any, params: ValidateEventLogParams) {
  const duration = event?.event?.duration;
  const eventStart = Date.parse(event?.event?.start || 'undefined');
  const eventEnd = Date.parse(event?.event?.end || 'undefined');
  const dateNow = Date.now();

  expect(typeof duration).to.be('string');
  expect(eventStart).to.be.ok();
  expect(eventEnd).to.be.ok();

  expect(eventStart <= eventEnd).to.equal(true);
  expect(eventEnd <= dateNow).to.equal(true);

  const outcome = params.outcome;
  expect(event?.event?.outcome).to.equal(outcome);
  expect(event?.kibana?.alerting?.outcome).to.equal(outcome);

  expect(event?.kibana?.saved_objects).to.eql([
    {
      rel: 'primary',
      type: RULE_SAVED_OBJECT_TYPE,
      id: params.ruleId,
      type_id: params.ruleTypeId,
    },
  ]);

  expect(event?.kibana?.alert?.rule?.execution?.metrics?.number_of_triggered_actions).to.be(1);
  expect(event?.kibana?.alert?.rule?.execution?.metrics?.number_of_searches).to.be(1);
  // Sometimes fast enough that it will report 0ms
  expect(event?.kibana?.alert?.rule?.execution?.metrics?.es_search_duration_ms >= 0).to.be.ok();
  expect(
    event?.kibana?.alert?.rule?.execution?.metrics?.total_search_duration_ms
  ).to.be.greaterThan(0);
  expect(event?.kibana?.alert?.rule?.execution?.metrics?.alert_counts?.active).to.be(1);
  expect(event?.kibana?.alert?.rule?.execution?.metrics?.alert_counts?.new).to.be(1);
  expect(event?.kibana?.alert?.rule?.execution?.metrics?.alert_counts?.recovered).to.be(0);

  expect(
    event?.kibana?.alert?.rule?.execution?.metrics?.claim_to_start_duration_ms
  ).to.be.greaterThan(0);
  expect(event?.kibana?.alert?.rule?.execution?.metrics?.total_run_duration_ms).to.be.greaterThan(
    0
  );
  expect(
    event?.kibana?.alert?.rule?.execution?.metrics?.prepare_rule_duration_ms
  ).to.be.greaterThan(0);
  expect(
    event?.kibana?.alert?.rule?.execution?.metrics?.rule_type_run_duration_ms
  ).to.be.greaterThan(0);
  // Process alerts is fast enough that it will sometimes report 0ms
  const procesAlertsDurationMs =
    event?.kibana?.alert?.rule?.execution?.metrics?.process_alerts_duration_ms;
  expect(
    (typeof procesAlertsDurationMs === 'number' ? procesAlertsDurationMs : -1) >= 0
  ).to.be.ok();
  expect(
    event?.kibana?.alert?.rule?.execution?.metrics?.trigger_actions_duration_ms
  ).to.be.greaterThan(0);
  expect(
    event?.kibana?.alert?.rule?.execution?.metrics?.process_rule_duration_ms
  ).to.be.greaterThan(0);

  expect(event?.rule).to.eql({
    id: params.ruleId,
    license: 'basic',
    category: params.ruleTypeId,
    ruleset: event?.rule.ruleset,
    name: params.name,
  });

  expect(event?.message).to.eql(params.message);

  if (params.errorMessage) {
    expect(event?.error?.message).to.eql(params.errorMessage);
  }
}
