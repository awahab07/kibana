/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import querystring from 'querystring';
import rison from '@kbn/rison';
import expect from '@kbn/expect';
import { WebElementWrapper } from '@kbn/ftr-common-functional-ui-services';
import {
  OBSERVABILITY_DATASET_QUALITY_URL_STATE_KEY,
  datasetQualityUrlSchemaV1,
} from '@kbn/observability-logs-explorer-plugin/common';
import { FtrProviderContext } from '../ftr_provider_context';

const defaultPageState: datasetQualityUrlSchemaV1.UrlSchema = {
  v: 1,
  table: {
    page: {
      index: 0,
      size: 10,
    },
  },
  filters: {},
  flyout: {},
};

export function DatasetQualityPageObject({ getPageObjects, getService }: FtrProviderContext) {
  const PageObjects = getPageObjects(['common']);
  const testSubjects = getService('testSubjects');
  const retry = getService('retry');

  const selectors = {
    datasetQualityTable: '[data-test-subj="datasetQualityTable"]',
    datasetQualityTableColumn: (column: number) =>
      `[data-test-subj="datasetQualityTable"] .euiTableRowCell:nth-child(${column})`,
  };

  const testSubjectSelectors = {
    datasetQualityTable: 'datasetQualityTable',
    datasetQualityFiltersContainer: 'datasetQualityFiltersContainer',
    datasetQualityExpandButton: 'datasetQualityExpandButton',
    datasetQualityFlyout: 'datasetQualityFlyout',
    datasetQualityFlyoutBody: 'datasetQualityFlyoutBody',
    datasetQualityFlyoutTitle: 'datasetQualityFlyoutTitle',
    datasetQualityFlyoutOpenInLogsExplorerButton: 'datasetQualityFlyoutOpenInLogsExplorerButton',
    datasetQualityFlyoutFieldValue: 'datasetQualityFlyoutFieldValue',

    superDatePickerApplyTimeButton: 'superDatePickerApplyTimeButton',
    euiFlyoutCloseButton: 'euiFlyoutCloseButton',
  };

  return {
    selectors,
    testSubjectSelectors,

    async navigateTo({
      pageState,
    }: {
      pageState?: datasetQualityUrlSchemaV1.UrlSchema;
    } = {}) {
      const queryStringParams = querystring.stringify({
        [OBSERVABILITY_DATASET_QUALITY_URL_STATE_KEY]: rison.encode(
          datasetQualityUrlSchemaV1.urlSchemaRT.encode({
            ...defaultPageState,
            ...pageState,
          })
        ),
      });

      return PageObjects.common.navigateToUrlWithBrowserHistory(
        'observabilityLogsExplorer',
        '/dataset-quality',
        queryStringParams,
        {
          // the check sometimes is too slow for the page so it misses the point
          // in time before the app rewrites the URL
          ensureCurrentUrl: false,
        }
      );
    },

    getDatasetsTable(): Promise<WebElementWrapper> {
      return testSubjects.find(testSubjectSelectors.datasetQualityTable);
    },

    async refreshTable() {
      const filtersContainer = await testSubjects.find(
        testSubjectSelectors.datasetQualityFiltersContainer
      );
      const refreshButton = await filtersContainer.findByTestSubject(
        testSubjectSelectors.superDatePickerApplyTimeButton
      );
      return refreshButton.click();
    },

    async getDatasetTableRows(): Promise<WebElementWrapper[]> {
      const table = await testSubjects.find(testSubjectSelectors.datasetQualityTable);
      const tBody = await table.findByTagName('tbody');
      return tBody.findAllByTagName('tr');
    },

    async parseDatasetTable() {
      const table = await this.getDatasetsTable();
      return parseDatasetTable(table, [
        '0',
        'Dataset Name',
        'Namespace',
        'Size',
        'Degraded Docs',
        'Last Activity',
        'Actions',
      ]);
    },

    async openDatasetFlyout(datasetName: string) {
      const cols = await this.parseDatasetTable();

      const datasetNameCol = cols['Dataset Name'];
      const datasetNameColCellTexts = await datasetNameCol.getCellTexts();

      const testDatasetRowIndex = datasetNameColCellTexts.findIndex(
        (dName) => dName === datasetName
      );

      const expanderColumn = cols['0'];
      let expanderButtons: WebElementWrapper[];

      await retry.try(async () => {
        expanderButtons = await expanderColumn.getCellChildren(
          `[data-test-subj=${testSubjectSelectors.datasetQualityExpandButton}]`
        );
        expect(expanderButtons.length).to.be.greaterThan(0);

        await expanderButtons[testDatasetRowIndex].click(); // Click "Open"
      });
    },

    async closeFlyout() {
      return testSubjects.click(testSubjectSelectors.euiFlyoutCloseButton);
    },

    async getFlyoutElementsByText(selector: string, text: string) {
      const flyoutContainer: WebElementWrapper = await testSubjects.find(
        testSubjectSelectors.datasetQualityFlyout
      );

      return getAllByText(flyoutContainer, selector, text);
    },

    getFlyoutLogsExplorerButton() {
      return testSubjects.find(testSubjectSelectors.datasetQualityFlyoutOpenInLogsExplorerButton);
    },

    async doestTextExistInFlyout(text: string, elementSelector: string) {
      const flyoutContainer: WebElementWrapper = await testSubjects.find(
        testSubjectSelectors.datasetQualityFlyoutBody
      );

      const elements = await getAllByText(flyoutContainer, elementSelector, text);
      return elements.length > 0;
    },
  };
}

async function parseDatasetTable(tableWrapper: WebElementWrapper, columnNamesOrIndexes: string[]) {
  const headerElementWrappers = await tableWrapper.findAllByCssSelector('thead th, thead td');

  const result: Record<
    string,
    {
      columnNameOrIndex: string;
      sortDirection?: 'ascending' | 'descending';
      headerElement: WebElementWrapper;
      cellElements: WebElementWrapper[];
      cellContentElements: WebElementWrapper[];
      getSortDirection: () => Promise<'ascending' | 'descending' | undefined>;
      sort: (sortDirection: 'ascending' | 'descending') => Promise<void>;
      getCellTexts: (selector?: string) => Promise<string[]>;
      getCellChildren: (selector: string) => Promise<WebElementWrapper[]>;
    }
  > = {};

  for (let i = 0; i < headerElementWrappers.length; i++) {
    const tdSelector = `table > tbody > tr td:nth-child(${i + 1})`;
    const cellContentSelector = `${tdSelector} .euiTableCellContent`;
    const thWrapper = headerElementWrappers[i];
    const columnName = await thWrapper.getVisibleText();
    const columnIndex = `${i}`;
    const columnNameOrIndex = columnNamesOrIndexes.includes(columnName)
      ? columnName
      : columnNamesOrIndexes.includes(columnIndex)
      ? columnIndex
      : undefined;

    if (columnNameOrIndex) {
      const headerElement = thWrapper;

      const tdWrappers = await tableWrapper.findAllByCssSelector(tdSelector);
      const cellContentWrappers = await tableWrapper.findAllByCssSelector(cellContentSelector);

      const getSortDirection = () =>
        headerElement.getAttribute('aria-sort') as Promise<'ascending' | 'descending' | undefined>;

      result[columnNameOrIndex] = {
        columnNameOrIndex,
        headerElement,
        cellElements: tdWrappers,
        cellContentElements: cellContentWrappers,
        getSortDirection,
        sort: async (sortDirection: 'ascending' | 'descending') => {
          if ((await getSortDirection()) !== sortDirection) {
            await headerElement.click();
          }

          // Sorting twice if the sort was in neutral state
          if ((await getSortDirection()) !== sortDirection) {
            await headerElement.click();
          }
        },
        getCellTexts: async (textContainerSelector?: string) => {
          const cellContentContainerWrappers = textContainerSelector
            ? await tableWrapper.findAllByCssSelector(`${tdSelector} ${textContainerSelector}`)
            : cellContentWrappers;

          const cellContentContainerWrapperTexts: string[] = [];
          for (let j = 0; j < cellContentContainerWrappers.length; j++) {
            const cellContentContainerWrapper = cellContentContainerWrappers[j];
            const cellContentContainerWrapperText =
              await cellContentContainerWrapper.getVisibleText();
            cellContentContainerWrapperTexts.push(cellContentContainerWrapperText);
          }

          return cellContentContainerWrapperTexts;
        },
        getCellChildren: (childSelector: string) => {
          return tableWrapper.findAllByCssSelector(`${cellContentSelector} ${childSelector}`);
        },
      };
    }
  }

  return result;
}

export async function getAllByText(container: WebElementWrapper, selector: string, text: string) {
  const elements = await container.findAllByCssSelector(selector);
  const matchingElements: WebElementWrapper[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const elementText = await element.getVisibleText();
    if (elementText === text) {
      matchingElements.push(element);
    }
  }

  return matchingElements;
}
