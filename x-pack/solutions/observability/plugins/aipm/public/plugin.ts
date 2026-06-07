/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DEFAULT_APP_CATEGORIES } from '@kbn/core/public';
import type { AppMountParameters, CoreSetup, CoreStart, Plugin } from '@kbn/core/public';
import { i18n } from '@kbn/i18n';
import type { AipmPluginSetup, AipmPluginStart, AppPluginStartDependencies } from './types';
import { PLUGIN_ID, PLUGIN_NAME } from '../common';

export class AipmPlugin implements Plugin<AipmPluginSetup, AipmPluginStart> {
  public setup(core: CoreSetup): AipmPluginSetup {
    core.application.register({
      id: PLUGIN_ID,
      title: i18n.translate('xpack.aipm.appTitle', {
        defaultMessage: PLUGIN_NAME,
      }),
      category: DEFAULT_APP_CATEGORIES.observability,
      async mount(params: AppMountParameters) {
        const { renderApp } = await import('./application');
        const [coreStart, depsStart] = await core.getStartServices();

        return renderApp(coreStart, depsStart as AppPluginStartDependencies, params);
      },
    });

    return {};
  }

  public start(_core: CoreStart): AipmPluginStart {
    return {};
  }

  public stop() {}
}
