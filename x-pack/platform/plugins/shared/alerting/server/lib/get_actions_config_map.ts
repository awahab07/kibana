/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { omit } from 'lodash';
import type { ActionsConfig, ActionTypeConfig } from '../config';

export interface ActionsConfigMap {
  default: ActionTypeConfig;

  [key: string]: ActionTypeConfig;
}

export const getActionsConfigMap = (actionsConfig: ActionsConfig): ActionsConfigMap => {
  const configsByConnectorType = actionsConfig.connectorTypeOverrides?.reduce(
    (config, configByConnectorType) => {
      config[configByConnectorType.id] = omit(configByConnectorType, 'id') as ActionTypeConfig;
      return config;
    },
    {} as Record<string, ActionTypeConfig>
  );
  return {
    default: omit(actionsConfig, 'connectorTypeOverrides'),
    ...configsByConnectorType,
  };
};
