/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient, type Logger } from '@kbn/core/server';
import type { AnalyticsServiceSetup } from '@kbn/core/public';
import { TelemetryPluginStart } from '@kbn/telemetry-plugin/server';

import { DataTelemetryService } from './data_telemetry_service';
import {
  STARTUP_DELAY,
  TELEMETRY_INTERVAL,
  BREATHE_DELAY_MEDIUM,
  MAX_STREAMS_TO_REPORT,
} from './constants';

// Mock the constants module
jest.mock('./constants', () => ({
  ...jest.requireActual('./constants'),
  STARTUP_DELAY: 1000,
  TELEMETRY_INTERVAL: 5000,

  BREATHE_DELAY_SHORT: 10,
  BREATHE_DELAY_MEDIUM: 50,
  BREATHE_DELAY_LONG: 100,

  MAX_STREAMS_TO_REPORT: 50,

  LOGS_DATASET_INDEX_PATTERNS: [
    {
      pattern: 'test-pattern-*',
      patternName: 'test',
      shipper: 'custom',
    },
    {
      pattern: 'test-pattern-2-*',
      patternName: 'test-2',
      shipper: 'custom-2',
    },
  ],
}));

const TEST_TIMEOUT = 60 * 1000;

describe('DataTelemetryService', () => {
  let service: DataTelemetryService;
  let mockEsClient: jest.Mocked<ElasticsearchClient>;
  let mockAnalyticsSetup: jest.Mocked<AnalyticsServiceSetup>;
  let mockTelemetryStart: jest.Mocked<TelemetryPluginStart>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(async () => {
    mockEsClient = {
      indices: {
        stats: jest.fn().mockImplementation((params) => {
          return params.index === 'logs-postgresql.log-default'
            ? MOCK_POSTGRES_DEFAULT_STATS
            : MOCK_POSTGRES_NON_DEFAULT_STATS;
        }),
        getDataStream: jest.fn().mockResolvedValue({
          data_streams: [...MOCK_POSTGRES_DATA_STREAMS, ...MOCK_SYNTH_DATA_STREAMS],
        }),
        get: jest.fn().mockResolvedValue(MOCK_INDICES),
        getMapping: jest.fn().mockImplementation((params) => {
          const genericMapping = MOCK_APACHE_GENERIC_INDEX_MAPPING;
          const postgresMapping = params.index.includes('non-default')
            ? MOCK_POSTGRES_NON_DEFAULT_MAPPINGS
            : MOCK_POSTGRES_DEFAULT_MAPPINGS;

          return { ...genericMapping, ...postgresMapping };
        }),
      },
      info: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ElasticsearchClient>;

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockAnalyticsSetup = {
      getTelemetryUrl: jest.fn().mockResolvedValue(new URL('https://telemetry.elastic.co')),
    } as unknown as jest.Mocked<AnalyticsServiceSetup>;

    mockTelemetryStart = {
      getIsOptedIn: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<TelemetryPluginStart>;

    service = new DataTelemetryService(mockLogger);
    service.setup(mockAnalyticsSetup);
    await service.start(mockTelemetryStart, {
      elasticsearch: { client: { asInternalUser: mockEsClient } },
    } as any);

    jest.spyOn(service as any, 'isTelemetryOptedIn').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it(
    'should collect and send telemetry after startup and every interval',
    async () => {
      const collectAndSendSpy = jest.spyOn(service as any, 'collectAndSend');

      await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY));
      expect(collectAndSendSpy).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, BREATHE_DELAY_MEDIUM * 25));
      expect(mockEsClient.indices.getMapping).toHaveBeenCalledTimes(3);

      await new Promise((resolve) => setTimeout(resolve, TELEMETRY_INTERVAL));
      expect(collectAndSendSpy).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => setTimeout(resolve, BREATHE_DELAY_MEDIUM * 25));
      expect(mockEsClient.indices.getMapping).toHaveBeenCalledTimes(6);

      // getMapping should not be called for non logs data streams e.g. logs-synth
      MOCK_SYNTH_DATA_STREAMS[0].indices.forEach((index) => {
        expect(mockEsClient.indices.getMapping).not.toHaveBeenCalledWith({
          index: index.index_name,
        });
      });
    },
    TEST_TIMEOUT
  );

  it(
    'should stop collecting and sending telemetry if stopped',
    async () => {
      const collectAndSendSpy = jest.spyOn(service as any, 'collectAndSend');

      await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY));
      expect(collectAndSendSpy).toHaveBeenCalledTimes(1);

      service.stop();

      await new Promise((resolve) => setTimeout(resolve, TELEMETRY_INTERVAL));
      await new Promise((resolve) => setTimeout(resolve, BREATHE_DELAY_MEDIUM));
      expect(collectAndSendSpy).toHaveBeenCalledTimes(1);
    },
    TEST_TIMEOUT
  );

  it(
    'should not collect data if telemetry is not opted in',
    async () => {
      jest.spyOn(service as any, 'isTelemetryOptedIn').mockResolvedValue(false);

      const collectAndSendSpy = jest.spyOn(service as any, 'collectAndSend');

      await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY));
      expect(collectAndSendSpy).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, TELEMETRY_INTERVAL));
      expect(collectAndSendSpy).not.toHaveBeenCalled();

      // Assert that logger.debug is called with appropriate message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Logs Data Telemetry] Telemetry is not opted-in.'
      );
    },
    TEST_TIMEOUT
  );

  it(
    'should not collect if number of data streams exceed MAX_STREAMS_TO_REPORT',
    async () => {
      (mockEsClient.indices.getDataStream as unknown as jest.Mock).mockResolvedValue({
        data_streams: Array.from({ length: MAX_STREAMS_TO_REPORT + 1 }, (_, i) => ({
          name: `logs-postgresql.log-default-${i}`,
          indices: [
            {
              index_name: `.ds-logs-postgresql.log-default-${i}-000001`,
            },
          ],
          _meta: {
            managed: true,
            description: 'default logs template installed by x-pack',
          },
        })),
      });

      await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY));
      await new Promise((resolve) => setTimeout(resolve, TELEMETRY_INTERVAL));
      await new Promise((resolve) =>
        setTimeout(resolve, 2 * (MAX_STREAMS_TO_REPORT + 1) * BREATHE_DELAY_MEDIUM)
      );

      expect(mockEsClient.indices.getMapping).not.toHaveBeenCalled();
    },
    TEST_TIMEOUT
  );

  it(
    'creates and sends the telemetry events',
    async () => {
      jest.spyOn(service as any, 'isTelemetryOptedIn').mockResolvedValue(true);

      const reportEventsSpy = jest.spyOn(service as any, 'reportEvents');

      await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY));
      await new Promise((resolve) => setTimeout(resolve, TELEMETRY_INTERVAL));

      // expect(mockAnalyticsSetup.getTelemetryUrl).toHaveBeenCalledTimes(1); // TODO: Assert when used
      expect(reportEventsSpy).toHaveBeenCalledTimes(1);
      expect(reportEventsSpy.mock?.lastCall?.[0]).toEqual([
        expect.objectContaining({
          number_of_documents: 4000 + 500 + 500,
          number_of_indices: 2 + 1 + 1,
          number_of_namespaces: 1 + 1,
          size_in_bytes: 10089898 + 800000 + 800000,
          pattern_name: 'test',
        }),
      ]);
    },
    TEST_TIMEOUT
  );
});

const MOCK_POSTGRES_DATA_STREAMS = [
  {
    name: 'logs-postgresql.log-default',
    indices: [
      {
        index_name: '.ds-logs-postgresql.log-default-2024.07.31-000001',
      },
      {
        index_name: '.ds-logs-postgresql.log-default-2024.08.31-000002',
      },
    ],
    _meta: {
      managed: true,
      description: 'default logs template installed by x-pack',
    },
  },
  {
    name: 'logs-postgresql.log-non-default',
    indices: [
      {
        index_name: '.ds-logs-postgresql.log-non-default-2024.07.31-000001',
      },
    ],
    _meta: {
      managed: true,
      description: 'default logs template installed by x-pack',
    },
  },
];
const MOCK_POSTGRES_DEFAULT_STATS = {
  _all: {
    primaries: {
      docs: {
        count: 4000,
        deleted: 0,
        total_size_in_bytes: 10089898,
      },
      store: {
        size_in_bytes: 10089898,
      },
    },
  },
  indices: {
    '.ds-logs-postgresql.log-default-2024.07.31-000001': {},
    '.ds-logs-postgresql.log-default-2024.08.31-000002': {},
  },
};

const MOCK_POSTGRES_NON_DEFAULT_STATS = {
  _all: {
    primaries: {
      docs: {
        count: 500,
        deleted: 0,
        total_size_in_bytes: 800000,
      },
      store: {
        size_in_bytes: 800000,
      },
    },
  },
  indices: {
    '.ds-logs-postgresql.log-non-default-2024.07.31-000001': {},
  },
};

const MOCK_POSTGRES_DEFAULT_MAPPINGS = {
  '.ds-logs-postgresql.log-default-2024.08.31-000002': {
    mappings: {
      properties: {
        '@timestamp': {
          type: 'date',
          ignore_malformed: false,
        },
        data_stream: {
          properties: {
            dataset: {
              type: 'constant_keyword',
              value: 'postgresql.log',
            },
            namespace: {
              type: 'constant_keyword',
              value: 'default',
            },
            type: {
              type: 'constant_keyword',
              value: 'logs',
            },
          },
        },
      },
    },
  },
};

const MOCK_POSTGRES_NON_DEFAULT_MAPPINGS = {
  '.ds-logs-postgresql.log-non-default-2024.07.31-000001': {
    mappings: {
      properties: {
        '@timestamp': {
          type: 'date',
          ignore_malformed: false,
        },
        data_stream: {
          properties: {
            dataset: {
              type: 'constant_keyword',
              value: 'postgresql.log',
            },
            namespace: {
              type: 'constant_keyword',
              value: 'non-default',
            },
            type: {
              type: 'constant_keyword',
              value: 'logs',
            },
          },
        },
      },
    },
  },
};

const MOCK_SYNTH_DATA_STREAMS = [
  {
    name: 'logs-synth.01-default',
    indices: [
      {
        index_name: '.ds-logs-synth.01-default-2024.07.31-000001',
      },
      {
        index_name: '.ds-logs-synth.01-default-2024.08.31-000002',
      },
    ],
    _meta: {
      managed: true,
      description: 'default logs template installed by x-pack',
    },
  },
];

const MOCK_INDICES = {
  'apache-generic-index': {},
  '.ds-logs-postgresql.log-default-2024.07.31-000001': {},
  '.ds-logs-postgresql.log-default-2024.08.31-000002': {},
  '.ds-logs-synth.01-default-2024.07.31-000001': {},
};

const MOCK_APACHE_GENERIC_INDEX_MAPPING = {
  'apache-generic-index': {
    mappings: {
      properties: {
        '@timestamp': {
          type: 'date',
          ignore_malformed: false,
        },
      },
    },
  },
};
