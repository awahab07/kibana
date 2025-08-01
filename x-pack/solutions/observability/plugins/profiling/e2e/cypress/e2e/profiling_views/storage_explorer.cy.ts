/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

describe('Storage explorer page', () => {
  const rangeFrom = '2023-04-18T00:00:00.000Z';
  const rangeTo = '2023-04-18T00:05:00.000Z';

  beforeEach(() => {
    cy.loginAsElastic();
  });

  it('does not show warning for distinct probabilistic profiling values found', () => {
    cy.intercept('GET', '/internal/profiling/storage_explorer/summary?*').as('summary');
    cy.visitKibana('/app/profiling/storage-explorer', {
      rangeFrom: '2023-08-08T18:00:00.000Z',
      rangeTo: '2023-08-08T20:00:00.000Z',
    });
    cy.contains('Storage explorer');
    cy.wait('@summary');
    cy.contains(
      "We've identified 2 distinct probabilistic profiling values. Make sure to update them."
    ).should('not.exist');
  });

  it('shows warning for distinct probabilistic profiling values found', () => {
    cy.intercept('GET', '/internal/profiling/storage_explorer/summary?*', {
      fixture: 'storage_explorer_summary.json',
    }).as('summary');
    cy.visitKibana('/app/profiling/storage-explorer', {
      rangeFrom: '2023-08-08T18:00:00.000Z',
      rangeTo: '2023-08-08T20:00:00.000Z',
    });
    cy.contains('Storage explorer');
    cy.wait('@summary');
    cy.contains(
      "We've identified 2 distinct probabilistic profiling values. Make sure to update them."
    );
  });

  describe('Host agent breakdown', () => {
    it('displays host agent details', () => {
      cy.intercept('GET', '/internal/profiling/storage_explorer/host_storage_details?*').as(
        'hostDetails'
      );
      cy.visitKibana('/app/profiling/storage-explorer', { rangeFrom, rangeTo });
      cy.contains('Storage explorer');
      cy.wait('@hostDetails');
      const firstRowSelector = 'table > tbody .euiTableRowCell';
      cy.get(firstRowSelector).eq(0).get('.euiTableCellContent__text').contains('3145700');
      cy.get('[data-test-subj="hostId_8457605156473051743"]').contains('[8457605156473051743]');
      cy.get('[data-test-subj="hostId_8457605156473051743"]').should(
        'have.attr',
        'href',
        '/app/profiling/flamegraphs/flamegraph?kuery=host.id%3A%20%228457605156473051743%22&rangeFrom=2023-04-18T00%3A00%3A00.000Z&rangeTo=2023-04-18T00%3A05%3A00.000Z'
      );
    });
  });

  describe('summary stats', () => {
    it('will still load with kuery', () => {
      cy.intercept('GET', '/internal/profiling/storage_explorer/summary?*', {
        fixture: 'storage_explorer_summary.json',
      }).as('summaryStats');
      cy.visitKibana('/app/profiling/storage-explorer', {
        rangeFrom,
        rangeTo,
        kuery: 'host.id : "1234"',
      });
      cy.wait('@summaryStats').then(({ request, response }) => {
        const {
          dailyDataGenerationBytes,
          diskSpaceUsedPct,
          totalNumberOfDistinctProbabilisticValues,
          totalNumberOfHosts,
          totalProfilingSizeBytes,
          totalSymbolsSizeBytes,
        } = response?.body;

        const { kuery } = request.query;

        expect(parseFloat(dailyDataGenerationBytes)).to.be.gt(0);
        expect(parseFloat(diskSpaceUsedPct)).to.be.gt(0);
        expect(parseFloat(totalNumberOfDistinctProbabilisticValues)).to.be.gt(0);
        expect(parseFloat(totalNumberOfHosts)).to.be.gt(0);
        expect(parseFloat(totalProfilingSizeBytes)).to.be.gt(0);
        expect(parseFloat(totalSymbolsSizeBytes)).to.be.gt(0);
        /*  eslint-disable @typescript-eslint/no-unused-expressions */
        expect(kuery).to.be.empty;
      });
    });
  });

  describe('Data breakdown', () => {
    beforeEach(() => {
      cy.intercept('GET', '/internal/profiling/storage_explorer/indices_storage_details?*').as(
        'indicesDetails'
      );
    });
    it('displays correct values per index', () => {
      cy.visitKibana('/app/profiling/storage-explorer', { rangeFrom, rangeTo });
      cy.contains('Storage explorer');
      cy.get('[data-test-subj="storageExplorer_dataBreakdownTab"]').click();
      cy.contains('Indices breakdown');
      cy.wait('@indicesDetails');
      [
        { indexName: 'stackframes', docSize: '7,616' },
        { indexName: 'stacktraces', docSize: '2,217' },
        { indexName: 'executables', docSize: '85' },
        { indexName: 'metrics', docSize: '0' },
        { indexName: 'events', docSize: '3,242' },
      ].forEach(({ indexName, docSize }) => {
        cy.get(`[data-test-subj="${indexName}_docSize"]`).contains(docSize);
      });
    });
  });
});
