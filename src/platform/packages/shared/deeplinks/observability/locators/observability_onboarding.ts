/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { SerializableRecord } from '@kbn/utility-types';

export const OBSERVABILITY_ONBOARDING_LOCATOR = 'OBSERVABILITY_ONBOARDING_LOCATOR' as const;

export interface ObservabilityOnboardingLocatorParams extends SerializableRecord {
  /** If given, it will load the given onboarding flow
   * else will load the main onboarding screen.
   */
  source?:
    | 'auto-detect'
    | 'customLogs'
    | 'kubernetes'
    | 'kubernetes-otel'
    | 'otel-logs'
    | 'firehose';
  category?: 'host' | 'kubernetes' | 'application' | 'cloud';
}
