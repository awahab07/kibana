/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SecuritySolutionApiRequestHandlerContext } from '../../../../../../types';
import type {
  RuleResponse,
  RuleToImport,
  ValidatedRuleToImport,
} from '../../../../../../../common/api/detection_engine';
import type { PrebuiltRuleAsset } from '../../../../prebuilt_rules';
import type { IPrebuiltRuleAssetsClient } from '../../../../prebuilt_rules/logic/rule_assets/prebuilt_rule_assets_client';
import { ensureLatestRulesPackageInstalled } from '../../../../prebuilt_rules/logic/integrations/ensure_latest_rules_package_installed';
import { calculateRuleSourceForImport } from '../calculate_rule_source_for_import';
import type { CalculatedRuleSource, IRuleSourceImporter } from './rule_source_importer_interface';
import type { IPrebuiltRuleObjectsClient } from '../../../../prebuilt_rules/logic/rule_objects/prebuilt_rule_objects_client';

interface RuleSpecifier {
  rule_id: string;
  version: number | undefined;
}

/**
 * Retrieves the rule IDs (`rule_id`s) of available prebuilt rule assets matching those
 * of the specified rules. This information can be used to determine whether
 * the rule being imported is a custom rule or a prebuilt rule.
 *
 * @param rules - A list of {@link RuleSpecifier}s representing the rules being imported.
 * @param ruleAssetsClient - the {@link IPrebuiltRuleAssetsClient} to use for fetching the available rule assets.
 *
 * @returns A list of the prebuilt rule asset IDs that are available.
 *
 */
const fetchAvailableRuleAssetIds = async ({
  rules,
  ruleAssetsClient,
}: {
  rules: RuleSpecifier[];
  ruleAssetsClient: IPrebuiltRuleAssetsClient;
}): Promise<string[]> => {
  const incomingRuleIds = rules.map((rule) => rule.rule_id);
  const availableRuleAssetSpecifiers = await ruleAssetsClient.fetchLatestVersions(incomingRuleIds);

  return availableRuleAssetSpecifiers.map((specifier) => specifier.rule_id);
};

/**
 * Retrieves prebuilt rule assets for rules being imported. These
 * assets can be compared to the incoming rules for the purposes of calculating
 * appropriate `rule_source` values.
 *
 * @param rules - A list of {@link RuleSpecifier}s representing the rules being imported.
 *
 * @returns The prebuilt rule assets matching the specified prebuilt
 * rules. Assets match the `rule_id` and `version` of the specified rules.
 * Because of this, there may be less assets returned than specified rules.
 */
const fetchMatchingAssets = async ({
  rules,
  ruleAssetsClient,
}: {
  rules: RuleSpecifier[];
  ruleAssetsClient: IPrebuiltRuleAssetsClient;
}): Promise<PrebuiltRuleAsset[]> => {
  const incomingRuleVersions = rules.flatMap((rule) => {
    if (rule.version == null) {
      return [];
    }
    return {
      rule_id: rule.rule_id,
      version: rule.version,
    };
  });

  return ruleAssetsClient.fetchAssetsByVersion(incomingRuleVersions);
};

/**
 *
 * This class contains utilities for assisting with the calculation of
 * `rule_source` during import. It ensures that the system contains the
 * necessary assets, and provides utilities for fetching information from them,
 * necessary for said calculation.
 */
export class RuleSourceImporter implements IRuleSourceImporter {
  private context: SecuritySolutionApiRequestHandlerContext;
  private ruleAssetsClient: IPrebuiltRuleAssetsClient;
  private ruleObjectsClient: IPrebuiltRuleObjectsClient;
  private latestPackagesInstalled: boolean = false;
  private matchingAssetsByRuleId: Record<string, PrebuiltRuleAsset> = {};
  private currentRulesById: Record<string, RuleResponse> = {};
  private rulesToImport: RuleSpecifier[] = [];
  private availableRuleAssetIds: Set<string> = new Set();

  constructor({
    context,
    prebuiltRuleAssetsClient,
    prebuiltRuleObjectsClient,
  }: {
    context: SecuritySolutionApiRequestHandlerContext;
    prebuiltRuleAssetsClient: IPrebuiltRuleAssetsClient;
    prebuiltRuleObjectsClient: IPrebuiltRuleObjectsClient;
  }) {
    this.ruleAssetsClient = prebuiltRuleAssetsClient;
    this.ruleObjectsClient = prebuiltRuleObjectsClient;
    this.context = context;
  }

  /**
   *
   * Prepares the importing of rules by ensuring the latest rules
   * package is installed and fetching the associated prebuilt rule assets.
   */
  public async setup(rules: RuleToImport[]): Promise<void> {
    if (!this.latestPackagesInstalled) {
      await ensureLatestRulesPackageInstalled(this.ruleAssetsClient, this.context);
      this.latestPackagesInstalled = true;
    }

    this.rulesToImport = rules.map((rule) => ({ rule_id: rule.rule_id, version: rule.version }));
    this.matchingAssetsByRuleId = await this.fetchMatchingAssetsByRuleId();
    this.availableRuleAssetIds = new Set(await this.fetchAvailableRuleAssetIds());
    this.currentRulesById = await this.fetchInstalledRulesByIds(
      this.rulesToImport.map((rule) => rule.rule_id)
    );
  }

  public isPrebuiltRule(rule: RuleToImport): boolean {
    this.validateRuleInput(rule);

    return this.availableRuleAssetIds.has(rule.rule_id);
  }

  public calculateRuleSource(rule: ValidatedRuleToImport): CalculatedRuleSource {
    this.validateRuleInput(rule);

    return calculateRuleSourceForImport({
      importedRule: rule,
      currentRule: this.currentRulesById[rule.rule_id],
      prebuiltRuleAssetsByRuleId: this.matchingAssetsByRuleId,
      isKnownPrebuiltRule: this.availableRuleAssetIds.has(rule.rule_id),
    });
  }

  private async fetchMatchingAssetsByRuleId(): Promise<Record<string, PrebuiltRuleAsset>> {
    this.validateSetupState();
    const matchingAssets = await fetchMatchingAssets({
      rules: this.rulesToImport,
      ruleAssetsClient: this.ruleAssetsClient,
    });

    return matchingAssets.reduce<Record<string, PrebuiltRuleAsset>>((map, asset) => {
      map[asset.rule_id] = asset;
      return map;
    }, {});
  }

  private async fetchInstalledRulesByIds(ruleIds: string[]): Promise<Record<string, RuleResponse>> {
    const currentRules = await this.ruleObjectsClient.fetchInstalledRulesByIds({
      ruleIds,
    });
    return Object.fromEntries(currentRules.map((rule) => [rule.rule_id, rule]));
  }

  private async fetchAvailableRuleAssetIds(): Promise<string[]> {
    this.validateSetupState();

    return fetchAvailableRuleAssetIds({
      rules: this.rulesToImport,
      ruleAssetsClient: this.ruleAssetsClient,
    });
  }

  /**
   * Runtime sanity checks to ensure no one's calling this stateful instance in the wrong way.
   *  */
  private validateSetupState() {
    if (!this.latestPackagesInstalled) {
      throw new Error('Expected rules package to be installed');
    }
  }

  private validateRuleInput(rule: RuleToImport) {
    if (
      !this.rulesToImport.some(
        (knownRule) =>
          knownRule.rule_id === rule.rule_id &&
          (knownRule.version === rule.version || knownRule.version == null)
      )
    ) {
      throw new Error(`Rule ${rule.rule_id} was not registered during setup.`);
    }
  }
}

export const createRuleSourceImporter = ({
  context,
  prebuiltRuleAssetsClient,
  prebuiltRuleObjectsClient,
}: {
  context: SecuritySolutionApiRequestHandlerContext;
  prebuiltRuleAssetsClient: IPrebuiltRuleAssetsClient;
  prebuiltRuleObjectsClient: IPrebuiltRuleObjectsClient;
}): RuleSourceImporter => {
  return new RuleSourceImporter({
    context,
    prebuiltRuleAssetsClient,
    prebuiltRuleObjectsClient,
  });
};
