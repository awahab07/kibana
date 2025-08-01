/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IRouter, CustomRequestHandlerContext, KibanaRequest } from '@kbn/core/server';
import type {
  ActionTypeConfig,
  ActionTypeSecrets,
  ActionTypeParams,
  ActionType,
} from '@kbn/actions-plugin/server/types';
import type { FilesSetup, FilesStart } from '@kbn/files-plugin/server';
import type { SecurityPluginSetup, SecurityPluginStart } from '@kbn/security-plugin/server';
import type {
  PluginSetupContract as ActionsPluginSetup,
  PluginStartContract as ActionsPluginStart,
} from '@kbn/actions-plugin/server';
import type { SpacesPluginSetup, SpacesPluginStart } from '@kbn/spaces-plugin/server';
import type { FeaturesPluginStart, FeaturesPluginSetup } from '@kbn/features-plugin/server';
import type { LensServerPluginSetup } from '@kbn/lens-plugin/server';
import type {
  TaskManagerSetupContract,
  TaskManagerStartContract,
} from '@kbn/task-manager-plugin/server';
import type { UsageCollectionSetup } from '@kbn/usage-collection-plugin/server';
import type { LicensingPluginSetup, LicensingPluginStart } from '@kbn/licensing-plugin/server';
import type { NotificationsPluginStart } from '@kbn/notifications-plugin/server';
import type { RuleRegistryPluginStartContract } from '@kbn/rule-registry-plugin/server';
import type { AlertingServerSetup } from '@kbn/alerting-plugin/server';
import type { CloudSetup } from '@kbn/cloud-plugin/server';
import type { CasesClient } from './client';
import type { AttachmentFramework } from './attachment_framework/types';
import type { ExternalReferenceAttachmentTypeRegistry } from './attachment_framework/external_reference_registry';
import type { PersistableStateAttachmentTypeRegistry } from './attachment_framework/persistable_state_registry';
import type { ConfigType } from './config';

export interface CasesServerSetupDependencies {
  alerting: AlertingServerSetup;
  actions: ActionsPluginSetup;
  lens: LensServerPluginSetup;
  features: FeaturesPluginSetup;
  files: FilesSetup;
  security: SecurityPluginSetup;
  licensing: LicensingPluginSetup;
  taskManager: TaskManagerSetupContract;
  usageCollection?: UsageCollectionSetup;
  spaces?: SpacesPluginSetup;
  cloud?: CloudSetup;
}

export interface CasesServerStartDependencies {
  actions: ActionsPluginStart;
  features: FeaturesPluginStart;
  files: FilesStart;
  licensing: LicensingPluginStart;
  taskManager: TaskManagerStartContract;
  security: SecurityPluginStart;
  spaces?: SpacesPluginStart;
  notifications: NotificationsPluginStart;
  ruleRegistry: RuleRegistryPluginStartContract;
}

export interface CaseRequestContext {
  getCasesClient: () => Promise<CasesClient>;
}

export type CasesRequestHandlerContext = CustomRequestHandlerContext<{
  cases: CaseRequestContext;
}>;

export type CasesRouter = IRouter<CasesRequestHandlerContext>;

export type RegisterActionType = <
  Config extends ActionTypeConfig = ActionTypeConfig,
  Secrets extends ActionTypeSecrets = ActionTypeSecrets,
  Params extends ActionTypeParams = ActionTypeParams,
  ExecutorResultData = void
>(
  actionType: ActionType<Config, Secrets, Params, ExecutorResultData>
) => void;

/**
 * Cases server exposed contract for interacting with cases entities.
 */
export interface CasesServerStart {
  /**
   * Returns a client which can be used to interact with the cases backend entities.
   *
   * @param request a KibanaRequest
   * @returns a {@link CasesClient}
   */
  getCasesClientWithRequest(request: KibanaRequest): Promise<CasesClient>;
  getExternalReferenceAttachmentTypeRegistry(): ExternalReferenceAttachmentTypeRegistry;
  getPersistableStateAttachmentTypeRegistry(): PersistableStateAttachmentTypeRegistry;
  config: ConfigType;
}

export interface CasesServerSetup {
  attachmentFramework: AttachmentFramework;
  config: ConfigType;
}

export type PartialField<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
