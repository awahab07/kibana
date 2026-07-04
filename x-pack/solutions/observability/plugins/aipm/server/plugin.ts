/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '@kbn/core/server';
import type { AipmPluginSetup, AipmPluginStart } from './types';
import { defineRoutes } from './routes';

export class AipmPlugin implements Plugin<AipmPluginSetup, AipmPluginStart> {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('aipm: Setup');

    const router = core.http.createRouter();
    defineRoutes(router);

    return {};
  }

  public start(_core: CoreStart) {
    this.logger.debug('aipm: Started');
    return {};
  }

  public stop() {}
}
