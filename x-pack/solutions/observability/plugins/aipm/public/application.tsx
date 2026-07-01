/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import type { AppMountParameters, CoreStart } from '@kbn/core/public';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import type { AppPluginStartDependencies } from './types';
import { AipmApp } from './components/app';

export const renderApp = (
  coreStart: CoreStart,
  { navigation }: AppPluginStartDependencies,
  { appBasePath, history, element }: AppMountParameters
) => {
  const { notifications, http } = coreStart;
  ReactDOM.render(
    <KibanaRenderContextProvider {...coreStart}>
      <AipmApp
        basename={appBasePath}
        history={history}
        notifications={notifications}
        http={http}
        navigation={navigation}
      />
    </KibanaRenderContextProvider>,
    element
  );

  return () => ReactDOM.unmountComponentAtNode(element);
};
