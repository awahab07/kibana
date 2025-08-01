/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { services as kibanaA11yServices } from '@kbn/test-suites-src/accessibility/services';
import { services as functionalServices } from '../functional_search/services';

export const services = {
  ...kibanaA11yServices,
  ...functionalServices,
};
