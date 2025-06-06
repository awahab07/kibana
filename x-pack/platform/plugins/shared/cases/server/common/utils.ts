/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  SavedObjectsFindResult,
  SavedObjectsFindResponse,
  SavedObject,
  SavedObjectReference,
  IBasePath,
} from '@kbn/core/server';
import { flatMap, uniqWith, xorWith } from 'lodash';
import type { LensServerPluginSetup } from '@kbn/lens-plugin/server';
import { addSpaceIdToPath } from '@kbn/spaces-plugin/common';
import type {
  ActionsAttachmentPayload,
  AlertAttachmentPayload,
  Attachment,
  AttachmentAttributes,
  Case,
  User,
  UserCommentAttachmentPayload,
} from '../../common/types/domain';
import {
  AttachmentType,
  ExternalReferenceSOAttachmentPayloadRt,
  FileAttachmentMetadataRt,
  CaseSeverity,
  CaseStatuses,
  ConnectorTypes,
} from '../../common/types/domain';
import { isValidOwner } from '../../common/utils/owner';
import {
  CASE_VIEW_COMMENT_PATH,
  CASE_VIEW_PATH,
  CASE_VIEW_TAB_PATH,
  GENERAL_CASES_OWNER,
  OWNER_INFO,
} from '../../common/constants';
import type { CASE_VIEW_PAGE_TABS } from '../../common/types';
import type { AlertInfo, FileAttachmentRequest } from './types';

import type { UpdateAlertStatusRequest } from '../client/alerts/types';
import {
  parseCommentString,
  getLensVisualizations,
} from '../../common/utils/markdown_plugins/utils';
import { dedupAssignees } from '../client/cases/utils';
import type { CaseSavedObjectTransformed, CaseTransformedAttributes } from './types/case';
import type {
  AttachmentRequest,
  AttachmentsFindResponse,
  CasePostRequest,
  CasesFindResponse,
} from '../../common/types/api';

/**
 * Default sort field for querying saved objects.
 */
export const defaultSortField = 'created_at';

/**
 * Default unknown user
 */
export const nullUser: User = { username: null, full_name: null, email: null };

export const transformNewCase = ({
  user,
  newCase,
}: {
  user: User;
  newCase: CasePostRequest;
}): CaseTransformedAttributes => ({
  ...newCase,
  duration: null,
  severity: newCase.severity ?? CaseSeverity.LOW,
  closed_at: null,
  closed_by: null,
  created_at: new Date().toISOString(),
  created_by: user,
  external_service: null,
  status: CaseStatuses.open,
  updated_at: null,
  updated_by: null,
  assignees: dedupAssignees(newCase.assignees) ?? [],
  category: newCase.category ?? null,
  customFields: newCase.customFields ?? [],
  observables: [],
  incremental_id: undefined,
});

export const transformCases = ({
  casesMap,
  countOpenCases,
  countInProgressCases,
  countClosedCases,
  page,
  perPage,
  total,
}: {
  casesMap: Map<string, Case>;
  countOpenCases: number;
  countInProgressCases: number;
  countClosedCases: number;
  page: number;
  perPage: number;
  total: number;
}): CasesFindResponse => ({
  page,
  per_page: perPage,
  total,
  cases: Array.from(casesMap.values()),
  count_open_cases: countOpenCases,
  count_in_progress_cases: countInProgressCases,
  count_closed_cases: countClosedCases,
});

export const flattenCaseSavedObject = ({
  savedObject,
  comments = [],
  totalComment = comments.length,
  totalAlerts = 0,
}: {
  savedObject: CaseSavedObjectTransformed;
  comments?: Array<SavedObject<AttachmentAttributes>>;
  totalComment?: number;
  totalAlerts?: number;
}): Case => ({
  id: savedObject.id,
  version: savedObject.version ?? '0',
  comments: flattenCommentSavedObjects(comments),
  totalComment,
  totalAlerts,
  ...savedObject.attributes,
});

export const transformComments = (
  comments: SavedObjectsFindResponse<AttachmentAttributes>
): AttachmentsFindResponse => ({
  page: comments.page,
  per_page: comments.per_page,
  total: comments.total,
  comments: flattenCommentSavedObjects(comments.saved_objects),
});

export const flattenCommentSavedObjects = (
  savedObjects: Array<SavedObject<AttachmentAttributes>>
): Attachment[] =>
  savedObjects.reduce((acc: Attachment[], savedObject: SavedObject<AttachmentAttributes>) => {
    acc.push(flattenCommentSavedObject(savedObject));
    return acc;
  }, []);

export const flattenCommentSavedObject = (
  savedObject: SavedObject<AttachmentAttributes>
): Attachment => ({
  id: savedObject.id,
  version: savedObject.version ?? '0',
  ...savedObject.attributes,
});

export const getIDsAndIndicesAsArrays = (
  comment: AlertAttachmentPayload
): { ids: string[]; indices: string[] } => {
  return {
    ids: Array.isArray(comment.alertId) ? comment.alertId : [comment.alertId],
    indices: Array.isArray(comment.index) ? comment.index : [comment.index],
  };
};

/**
 * This functions extracts the ids and indices from an alert comment. It enforces that the alertId and index are either
 * both strings or string arrays that are the same length. If they are arrays they represent a 1-to-1 mapping of
 * id existing in an index at each position in the array. This is not ideal. Ideally an alert comment request would
 * accept an array of objects like this: Array<{id: string; index: string; ruleName: string ruleID: string}> instead.
 *
 * To reformat the alert comment request requires a migration and a breaking API change.
 */
const getAndValidateAlertInfoFromComment = (comment: AttachmentRequest): AlertInfo[] => {
  if (!isCommentRequestTypeAlert(comment)) {
    return [];
  }

  const { ids, indices } = getIDsAndIndicesAsArrays(comment);

  if (ids.length !== indices.length) {
    return [];
  }

  return ids.map((id, index) => ({ id, index: indices[index] }));
};

/**
 * Builds an AlertInfo object accumulating the alert IDs and indices for the passed in alerts.
 */
export const getAlertInfoFromComments = (comments: AttachmentRequest[] = []): AlertInfo[] =>
  comments.reduce((acc: AlertInfo[], comment) => {
    const alertInfo = getAndValidateAlertInfoFromComment(comment);
    acc.push(...alertInfo);
    return acc;
  }, []);

type NewCommentArgs = AttachmentRequest & {
  createdDate: string;
  owner: string;
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  profile_uid?: string;
};

export const transformNewComment = ({
  createdDate,
  email,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  full_name,
  username,
  profile_uid: profileUid,
  ...comment
}: NewCommentArgs): AttachmentAttributes => {
  return {
    ...comment,
    created_at: createdDate,
    created_by: { email, full_name, username, profile_uid: profileUid },
    pushed_at: null,
    pushed_by: null,
    updated_at: null,
    updated_by: null,
  };
};

/**
 * A type narrowing function for user comments.
 */
export const isCommentRequestTypeUser = (
  context: AttachmentRequest
): context is UserCommentAttachmentPayload => {
  return context.type === AttachmentType.user;
};

/**
 * A type narrowing function for actions comments.
 */
export const isCommentRequestTypeActions = (
  context: AttachmentRequest
): context is ActionsAttachmentPayload => {
  return context.type === AttachmentType.actions;
};

/**
 * A type narrowing function for alert comments.
 */
export const isCommentRequestTypeAlert = (
  context: AttachmentRequest
): context is AlertAttachmentPayload => {
  return context.type === AttachmentType.alert;
};

/**
 * Returns true if a Comment Request is trying to create either a persistableState or an
 * externalReference attachment.
 */
export const isPersistableStateOrExternalReference = (context: AttachmentRequest): boolean => {
  return (
    context.type === AttachmentType.persistableState ||
    context.type === AttachmentType.externalReference
  );
};

/**
 * A type narrowing function for file attachments.
 */
export const isFileAttachmentRequest = (
  context: Partial<AttachmentRequest>
): context is FileAttachmentRequest => {
  return (
    ExternalReferenceSOAttachmentPayloadRt.is(context) &&
    FileAttachmentMetadataRt.is(context.externalReferenceMetadata)
  );
};

/**
 * Adds the ids and indices to a map of statuses
 */
export function createAlertUpdateStatusRequest({
  comment,
  status,
}: {
  comment: AttachmentRequest;
  status: CaseStatuses;
}): UpdateAlertStatusRequest[] {
  return getAlertInfoFromComments([comment]).map((alert) => ({ ...alert, status }));
}

/**
 * Counts the total alert IDs within a single comment.
 */
export const countAlerts = (comment: SavedObjectsFindResult<AttachmentAttributes>) => {
  let totalAlerts = 0;
  if (comment.attributes.type === AttachmentType.alert) {
    if (Array.isArray(comment.attributes.alertId)) {
      totalAlerts += comment.attributes.alertId.length;
    } else {
      totalAlerts++;
    }
  }
  return totalAlerts;
};

/**
 * Count the number of alerts for each id in the alert's references.
 */
export const groupTotalAlertsByID = ({
  comments,
}: {
  comments: SavedObjectsFindResponse<AttachmentAttributes>;
}): Map<string, number> => {
  return comments.saved_objects.reduce((acc, alertsInfo) => {
    const alertTotalForComment = countAlerts(alertsInfo);
    for (const alert of alertsInfo.references) {
      if (alert.id) {
        const totalAlerts = acc.get(alert.id);

        if (totalAlerts !== undefined) {
          acc.set(alert.id, totalAlerts + alertTotalForComment);
        } else {
          acc.set(alert.id, alertTotalForComment);
        }
      }
    }

    return acc;
  }, new Map<string, number>());
};

/**
 * Counts the total alert IDs for a single case.
 */
export const countAlertsForID = ({
  comments,
  id,
}: {
  comments: SavedObjectsFindResponse<AttachmentAttributes>;
  id: string;
}): number | undefined => {
  return groupTotalAlertsByID({ comments }).get(id);
};

/**
 * Returns a connector that indicates that no connector was set.
 *
 * @returns the 'none' connector
 */
export const getNoneCaseConnector = () => ({
  id: 'none',
  name: 'none',
  type: ConnectorTypes.none,
  fields: null,
});

export const extractLensReferencesFromCommentString = (
  lensEmbeddableFactory: LensServerPluginSetup['lensEmbeddableFactory'],
  comment: string
): SavedObjectReference[] => {
  const extract = lensEmbeddableFactory()?.extract;

  if (extract) {
    const parsedComment = parseCommentString(comment);
    const lensVisualizations = getLensVisualizations(parsedComment.children);
    const flattenRefs = flatMap(
      lensVisualizations,
      (lensObject) => extract(lensObject)?.references ?? []
    );

    const uniqRefs = uniqWith(
      flattenRefs,
      (refA, refB) => refA.type === refB.type && refA.id === refB.id && refA.name === refB.name
    );

    return uniqRefs;
  }
  return [];
};

export const getOrUpdateLensReferences = (
  lensEmbeddableFactory: LensServerPluginSetup['lensEmbeddableFactory'],
  newComment: string,
  currentComment?: SavedObject<UserCommentAttachmentPayload>
) => {
  if (!currentComment) {
    return extractLensReferencesFromCommentString(lensEmbeddableFactory, newComment);
  }

  const savedObjectReferences = currentComment.references;
  const savedObjectLensReferences = extractLensReferencesFromCommentString(
    lensEmbeddableFactory,
    currentComment.attributes.comment
  );

  const currentNonLensReferences = xorWith(
    savedObjectReferences,
    savedObjectLensReferences,
    (refA, refB) => refA.type === refB.type && refA.id === refB.id
  );

  const newCommentLensReferences = extractLensReferencesFromCommentString(
    lensEmbeddableFactory,
    newComment
  );

  return currentNonLensReferences.concat(newCommentLensReferences);
};

export const asArray = <T>(field?: T | T[] | null): T[] => {
  if (field === undefined || field === null) {
    return [];
  }

  return Array.isArray(field) ? field : [field];
};

export const assertUnreachable = (x: never): never => {
  throw new Error('You should not reach this part of code');
};

export const getApplicationRoute = (
  appRouteInfo: { [K in keyof typeof OWNER_INFO]: { appRoute: string } },
  owner: string
): string => {
  const appRoute = isValidOwner(owner)
    ? appRouteInfo[owner].appRoute
    : OWNER_INFO[GENERAL_CASES_OWNER].appRoute;

  return appRoute.startsWith('/') ? appRoute : `/${appRoute}`;
};

export const getCaseViewPath = (params: {
  publicBaseUrl: NonNullable<IBasePath['publicBaseUrl']>;
  spaceId: string;
  caseId: string;
  owner: string;
  commentId?: string;
  tabId?: CASE_VIEW_PAGE_TABS;
}): string => {
  const normalizePath = (path: string): string => path.replaceAll('//', '/');
  const removeEndingSlash = (path: string): string =>
    path.endsWith('/') ? path.slice(0, -1) : path;

  const { publicBaseUrl, caseId, owner, commentId, tabId, spaceId } = params;

  const publicBaseUrlWithoutEndingSlash = removeEndingSlash(publicBaseUrl);
  const publicBaseUrlWithSpace = addSpaceIdToPath(publicBaseUrlWithoutEndingSlash, spaceId);
  const appRoute = getApplicationRoute(OWNER_INFO, owner);
  const basePath = `${publicBaseUrlWithSpace}${appRoute}/cases`;

  if (commentId) {
    const commentPath = normalizePath(
      CASE_VIEW_COMMENT_PATH.replace(':detailName', caseId).replace(':commentId', commentId)
    );

    return `${basePath}${commentPath}`;
  }

  if (tabId) {
    const tabPath = normalizePath(
      CASE_VIEW_TAB_PATH.replace(':detailName', caseId).replace(':tabId', tabId)
    );

    return `${basePath}${tabPath}`;
  }

  return `${basePath}${normalizePath(CASE_VIEW_PATH.replace(':detailName', caseId))}`;
};

export const countUserAttachments = (
  attachments: Array<SavedObject<AttachmentAttributes>>
): number => {
  let total = 0;

  for (const attachment of attachments) {
    if (attachment.attributes.type === AttachmentType.user) {
      total += 1;
    }
  }

  return total;
};
