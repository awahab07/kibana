/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import axios from 'axios';
import { isEmpty } from 'lodash';

import type { Logger } from '@kbn/core/server';
import {
  request,
  getErrorMessage,
  throwIfResponseIsNotValid,
} from '@kbn/actions-plugin/server/lib/axios_utils';
import type { ActionsConfigurationUtilities } from '@kbn/actions-plugin/server/actions_config';
import { getBasicAuthHeader } from '@kbn/actions-plugin/server';
import type { ConnectorUsageCollector } from '@kbn/actions-plugin/server/types';
import type {
  CreateCommentParams,
  CreateIncidentParams,
  ExternalService,
  ExternalServiceCommentResponse,
  ExternalServiceCredentials,
  ExternalServiceIncidentResponse,
  Fields,
  FieldSchema,
  GetCommonFieldsResponse,
  Incident,
  JiraPublicConfigurationType,
  JiraSecretConfigurationType,
  ResponseError,
  UpdateIncidentParams,
} from './types';
import { escapeJqlSpecialCharacters } from './utils';

import * as i18n from './translations';

const VERSION = '2';
const BASE_URL = `rest/api/${VERSION}`;

const VIEW_INCIDENT_URL = `browse`;

export const createExternalService = (
  { config, secrets }: ExternalServiceCredentials,
  logger: Logger,
  configurationUtilities: ActionsConfigurationUtilities,
  connectorUsageCollector: ConnectorUsageCollector
): ExternalService => {
  const { apiUrl: url, projectKey } = config as JiraPublicConfigurationType;
  const { apiToken, email } = secrets as JiraSecretConfigurationType;

  if (!url || !projectKey || !apiToken || !email) {
    throw Error(`[Action]${i18n.NAME}: Wrong configuration.`);
  }

  const urlWithoutTrailingSlash = url.endsWith('/') ? url.slice(0, -1) : url;
  const incidentUrl = `${urlWithoutTrailingSlash}/${BASE_URL}/issue`;
  const commentUrl = `${incidentUrl}/{issueId}/comment`;
  const getIssueTypesUrl = `${urlWithoutTrailingSlash}/${BASE_URL}/issue/createmeta/${projectKey}/issuetypes`;
  const getIssueTypeFieldsUrl = `${urlWithoutTrailingSlash}/${BASE_URL}/issue/createmeta/${projectKey}/issuetypes/{issueTypeId}`;
  const searchUrl = `${urlWithoutTrailingSlash}/${BASE_URL}/search`;

  const axiosInstance = axios.create({
    headers: getBasicAuthHeader({ username: email, password: apiToken }),
  });

  const getIncidentViewURL = (key: string) => {
    return `${urlWithoutTrailingSlash}/${VIEW_INCIDENT_URL}/${key}`;
  };

  const getCommentsURL = (issueId: string) => {
    return commentUrl.replace('{issueId}', issueId);
  };
  const createGetIssueTypeFieldsUrl = (uri: string, issueTypeId: string) => {
    return uri.replace('{issueTypeId}', issueTypeId);
  };

  const createFields = (key: string, incident: Incident): Fields => {
    let fields: Fields = {
      summary: trimAndRemoveNewlines(incident.summary),
      project: { key },
    };

    if (incident.issueType) {
      fields = { ...fields, issuetype: { id: incident.issueType } };
    }

    if (incident.description) {
      fields = { ...fields, description: incident.description };
    }

    if (incident.labels) {
      fields = { ...fields, labels: incident.labels };
    }

    if (incident.priority) {
      fields = { ...fields, priority: { name: incident.priority } };
    }

    if (incident.parent) {
      fields = { ...fields, parent: { key: incident.parent } };
    }

    if (incident.otherFields) {
      fields = { ...fields, ...incident.otherFields };
    }

    return fields;
  };

  const trimAndRemoveNewlines = (str: string) =>
    str
      .split(/[\n\r]/gm)
      .map((item) => item.trim())
      .filter((item) => !isEmpty(item))
      .join(', ');

  const createErrorMessage = (errorResponse: ResponseError | null | undefined): string => {
    if (errorResponse == null) {
      return 'unknown: errorResponse was null';
    }

    const { errorMessages, errors } = errorResponse;

    if (Array.isArray(errorMessages) && errorMessages.length > 0) {
      return `${errorMessages.join(', ')}`;
    }

    if (errors == null) {
      return 'unknown: errorResponse.errors was null';
    }

    return Object.entries(errors).reduce((errorMessage, [, value]) => {
      const msg = errorMessage.length > 0 ? `${errorMessage} ${value}` : value;
      return msg;
    }, '');
  };

  const normalizeIssueTypes = (issueTypes: Array<{ id: string; name: string }>) =>
    issueTypes.map((type) => ({ id: type.id, name: type.name }));

  const normalizeFields = (fields: {
    [key: string]: {
      allowedValues?: Array<{}>;
      defaultValue?: {};
      name: string;
      required: boolean;
      schema: FieldSchema;
    };
  }) =>
    Object.keys(fields ?? {}).reduce(
      (fieldsAcc, fieldKey) => ({
        ...fieldsAcc,
        [fieldKey]: {
          required: fields[fieldKey]?.required,
          allowedValues: fields[fieldKey]?.allowedValues ?? [],
          defaultValue: fields[fieldKey]?.defaultValue ?? {},
          schema: fields[fieldKey]?.schema,
          name: fields[fieldKey]?.name,
        },
      }),
      {}
    );

  const normalizeSearchResults = (
    issues: Array<{ id: string; key: string; fields: { summary: string } }>
  ) =>
    issues.map((issue) => ({ id: issue.id, key: issue.key, title: issue.fields?.summary ?? null }));

  const normalizeIssue = (issue: { id: string; key: string; fields: { summary: string } }) => ({
    id: issue.id,
    key: issue.key,
    title: issue.fields?.summary ?? null,
  });

  const getIncident = async (id: string) => {
    try {
      const res = await request({
        axios: axiosInstance,
        url: `${incidentUrl}/${id}`,
        logger,
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
        requiredAttributesToBeInTheResponse: ['id', 'key'],
      });

      const { fields, id: incidentId, key } = res.data;

      return { id: incidentId, key, created: fields.created, updated: fields.updated, ...fields };
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to get incident with id ${id}. Error: ${
            error.message
          } Reason: ${createErrorMessage(error.response?.data)}`
        )
      );
    }
  };

  const createIncident = async ({
    incident,
  }: CreateIncidentParams): Promise<ExternalServiceIncidentResponse> => {
    /* The response from Jira when creating an issue contains only the key and the id.
      The function makes the following calls when creating an issue:
        1. Get issueTypes to set a default ONLY when incident.issueType is missing
        2. Create the issue.
        3. Get the created issue with all the necessary fields.
    */
    let issueType = incident.issueType;

    if (!incident.issueType) {
      const issueTypes = await getIssueTypes();
      issueType = issueTypes[0]?.id ?? '';
    }

    const fields = createFields(projectKey, {
      ...incident,
      issueType,
    });

    try {
      const res = await request({
        axios: axiosInstance,
        url: `${incidentUrl}`,
        logger,
        method: 'post',
        data: {
          fields,
        },
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
        requiredAttributesToBeInTheResponse: ['id'],
      });

      const updatedIncident = await getIncident(res.data.id);

      return {
        title: updatedIncident.key,
        id: updatedIncident.id,
        pushedDate: new Date(updatedIncident.created).toISOString(),
        url: getIncidentViewURL(updatedIncident.key),
      };
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to create incident. Error: ${error.message}. Reason: ${createErrorMessage(
            error.response?.data
          )}`
        )
      );
    }
  };

  const updateIncident = async ({
    incidentId,
    incident,
  }: UpdateIncidentParams): Promise<ExternalServiceIncidentResponse> => {
    const incidentWithoutNullValues = Object.entries(incident).reduce(
      (obj, [key, value]) => (value != null ? { ...obj, [key]: value } : obj),
      {} as Incident
    );

    const fields = createFields(projectKey, incidentWithoutNullValues);

    try {
      const res = await request({
        axios: axiosInstance,
        method: 'put',
        url: `${incidentUrl}/${incidentId}`,
        logger,
        data: { fields },
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
      });

      const updatedIncident = await getIncident(incidentId as string);

      return {
        title: updatedIncident.key,
        id: updatedIncident.id,
        pushedDate: new Date(updatedIncident.updated).toISOString(),
        url: getIncidentViewURL(updatedIncident.key),
      };
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to update incident with id ${incidentId}. Error: ${
            error.message
          }. Reason: ${createErrorMessage(error.response?.data)}`
        )
      );
    }
  };

  const createComment = async ({
    incidentId,
    comment,
  }: CreateCommentParams): Promise<ExternalServiceCommentResponse> => {
    try {
      const res = await request({
        axios: axiosInstance,
        method: 'post',
        url: getCommentsURL(incidentId),
        logger,
        data: { body: comment.comment },
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
        requiredAttributesToBeInTheResponse: ['id', 'created'],
      });

      return {
        commentId: comment.commentId,
        externalCommentId: res.data.id,
        pushedDate: new Date(res.data.created).toISOString(),
      };
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to create comment at incident with id ${incidentId}. Error: ${
            error.message
          }. Reason: ${createErrorMessage(error.response?.data)}`
        )
      );
    }
  };

  const getIssueTypes = async () => {
    try {
      const res = await request({
        axios: axiosInstance,
        method: 'get',
        url: getIssueTypesUrl,
        logger,
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
      });

      // Cloud returns issueTypes and Data Center returns values
      const { issueTypes, values } = res.data;
      return normalizeIssueTypes(issueTypes || values);
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to get issue types. Error: ${error.message}. Reason: ${createErrorMessage(
            error.response?.data
          )}`
        )
      );
    }
  };

  const getFieldsByIssueType = async (issueTypeId: string) => {
    try {
      const res = await request({
        axios: axiosInstance,
        method: 'get',
        url: createGetIssueTypeFieldsUrl(getIssueTypeFieldsUrl, issueTypeId),
        logger,
        configurationUtilities,
      });

      throwIfResponseIsNotValid({
        res,
      });

      // Cloud returns fields and Data Center returns values
      const { fields: rawFields, values } = res.data;
      const fields = (rawFields || values).reduce(
        (acc: { [x: string]: {} }, value: { fieldId: string }) => ({
          ...acc,
          [value.fieldId]: { ...value },
        }),
        {}
      );
      return normalizeFields(fields);
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to get fields. Error: ${error.message}. Reason: ${createErrorMessage(
            error.response?.data
          )}`
        )
      );
    }
  };

  const getFields = async () => {
    try {
      const issueTypes = await getIssueTypes();
      const fieldsPerIssueType = await Promise.all(
        issueTypes.map((issueType) => getFieldsByIssueType(issueType.id))
      );
      return fieldsPerIssueType.reduce((acc: GetCommonFieldsResponse, fieldTypesByIssue) => {
        const currentListOfFields = Object.keys(acc);
        return currentListOfFields.length === 0
          ? fieldTypesByIssue
          : currentListOfFields.reduce(
              (add: GetCommonFieldsResponse, field) =>
                Object.keys(fieldTypesByIssue).includes(field)
                  ? { ...add, [field]: acc[field] }
                  : add,
              {}
            );
      }, {});
    } catch (error) {
      // errors that happen here would be thrown in the contained async calls
      throw error;
    }
  };

  const getIssues = async (title: string) => {
    const jqlEscapedTitle = escapeJqlSpecialCharacters(title);
    const query = `${searchUrl}?jql=${encodeURIComponent(
      `project="${projectKey}" and summary ~"${jqlEscapedTitle}"`
    )}`;

    try {
      const res = await request({
        axios: axiosInstance,
        method: 'get',
        url: query,
        logger,
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
      });

      return normalizeSearchResults(res.data?.issues ?? []);
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to get issues. Error: ${error.message}. Reason: ${createErrorMessage(
            error.response?.data
          )}`
        )
      );
    }
  };

  const getIssue = async (id: string) => {
    const getIssueUrl = `${incidentUrl}/${id}`;
    try {
      const res = await request({
        axios: axiosInstance,
        method: 'get',
        url: getIssueUrl,
        logger,
        configurationUtilities,
        connectorUsageCollector,
      });

      throwIfResponseIsNotValid({
        res,
      });

      return normalizeIssue(res.data ?? {});
    } catch (error) {
      throw new Error(
        getErrorMessage(
          i18n.NAME,
          `Unable to get issue with id ${id}. Error: ${error.message}. Reason: ${createErrorMessage(
            error.response?.data
          )}`
        )
      );
    }
  };

  return {
    getFields,
    getIncident,
    createIncident,
    updateIncident,
    createComment,
    getIssueTypes,
    getFieldsByIssueType,
    getIssues,
    getIssue,
  };
};
