/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// import * as t from 'io-ts';
import { z } from '@kbn/zod';

import { /* chatCompleteInternalRt, */ chatCompleteInternalZod } from './route';

// const ioTsVar: t.TypeOf<typeof chatCompleteInternalRt> = {
// }

const zodTsVar: z.infer<typeof chatCompleteInternalZod> = {
  // Invoke autocompletion here for analysis
};
