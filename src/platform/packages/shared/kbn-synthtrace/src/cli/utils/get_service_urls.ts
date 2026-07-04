/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Url } from 'url';
import { format, parse } from 'url';
import { readKibanaConfig } from './read_kibana_config';
import type { Logger } from '../../lib/utils/create_logger';
import type { RunOptions } from './parse_run_cli_flags';
import { getFetchAgent } from './ssl';
import { getApiKeyHeader, getBasicAuthHeader } from './get_auth_header';

async function getFetchStatus(url: string, apiKey?: string) {
  try {
    const parsedUrl = new URL(url);
    const { username, password } = parsedUrl;
    parsedUrl.username = '';
    parsedUrl.password = '';
    const response = await fetch(parsedUrl.toString(), {
      dispatcher: getFetchAgent(parsedUrl.toString()),
      headers: {
        ...getBasicAuthHeader(username, password),
        ...getApiKeyHeader(apiKey),
      },
    } as RequestInit);
    return response.status;
  } catch (error) {
    return 0;
  }
}

function stripAuthIfCi(url: string) {
  if (process.env.CI?.toLowerCase() === 'true') {
    return format({
      ...parse(url),
      auth: undefined,
    });
  }
  return url;
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

const WELL_KNOWN_TOP_LEVEL =
  /^\/(api|app|internal|spaces|s|bundles|core|ui|translations|login|logout|security|mock_idp)(\/|$)/;

function stripKnownKibanaPaths(pathnameWithSearch: string) {
  return pathnameWithSearch
    .replace(/\/spaces\/enter\/?$/, '')
    .replace(/\/spaces\/space_selector\/?$/, '')
    .replace(/\/login\b.*$/, '')
    .replace(/\/mock_idp(?:\/.*)?$/, '')
    .replace(/\/internal\/security\/capture-url\b.*$/, '')
    .replace(/\/app\/.*$/, '')
    .replace(/\/$/, '');
}

function normalizeKibanaBaseUrl(targetKibanaUrl: string, location?: string | null) {
  const url = new URL(targetKibanaUrl);
  const redirectedUrl = location ? new URL(location, url.toString()) : url;
  const strippedPath = stripKnownKibanaPaths(`${redirectedUrl.pathname}${redirectedUrl.search}`);
  const normalizedUrl = new URL(url.toString());

  normalizedUrl.pathname =
    !strippedPath || WELL_KNOWN_TOP_LEVEL.test(`${strippedPath}/`) ? '/' : strippedPath;
  normalizedUrl.search = '';
  normalizedUrl.hash = '';

  return stripTrailingSlash(normalizedUrl.toString());
}

function getKibanaStatusUrl(kibanaUrl: string) {
  const url = new URL(kibanaUrl);
  const basePath = url.pathname.replace(/\/$/, '');

  url.pathname = `${basePath}/api/status`;
  url.search = 'v8format=true';
  url.hash = '';

  return url.toString();
}

async function getKibanaStatus(kibanaUrl: string, headers: HeadersInit | undefined) {
  const statusUrl = getKibanaStatusUrl(kibanaUrl);
  const response = await fetch(statusUrl, {
    method: 'GET',
    headers,
    dispatcher: getFetchAgent(statusUrl),
  } as RequestInit);

  return response.status;
}

function getRequestHeaders(headers?: { Authorization?: string }) {
  return headers?.Authorization ? { Authorization: headers.Authorization } : undefined;
}

async function discoverAuth(parsedTarget: Url) {
  const possibleCredentials = [`admin:changeme`, `elastic:changeme`, `elastic_serverless:changeme`];
  for (const auth of possibleCredentials) {
    const url = format({
      ...parsedTarget,
      auth,
    });

    const status = await getFetchStatus(url);
    if (status === 200) {
      return auth;
    }
  }

  throw new Error(`Failed to authenticate user for ${stripAuthIfCi(format(parsedTarget))}`);
}

async function getKibanaUrl({
  targetKibanaUrl,
  apiKey,
  logger,
}: {
  targetKibanaUrl: string;
  apiKey?: string;
  logger: Logger;
}) {
  try {
    logger.debug(`Checking Kibana URL ${stripAuthIfCi(targetKibanaUrl)} for a redirect`);

    const url = new URL(targetKibanaUrl);
    const { username, password } = url;
    url.username = '';
    url.password = '';
    const kibanaHeaders = apiKey ? getApiKeyHeader(apiKey) : getBasicAuthHeader(username, password);
    const requestHeaders = getRequestHeaders(kibanaHeaders);
    targetKibanaUrl = normalizeKibanaBaseUrl(url.toString());

    const unredirectedResponse = await fetch(targetKibanaUrl, {
      method: 'HEAD',
      redirect: 'manual',
      headers: requestHeaders,
      dispatcher: getFetchAgent(targetKibanaUrl),
    } as RequestInit);

    const discoveredKibanaUrl = normalizeKibanaBaseUrl(
      targetKibanaUrl,
      unredirectedResponse.headers.get('location')
    );
    const redirectedResponseStatus = await getKibanaStatus(discoveredKibanaUrl, requestHeaders);

    if (redirectedResponseStatus !== 200 && redirectedResponseStatus !== 503) {
      throw new Error(
        `Expected HTTP 200 or 503 from ${stripAuthIfCi(
          getKibanaStatusUrl(discoveredKibanaUrl)
        )}, got ${redirectedResponseStatus}`
      );
    }

    logger.debug(`Discovered kibana running at: ${stripAuthIfCi(discoveredKibanaUrl)}`);

    return {
      kibanaUrl: discoveredKibanaUrl.replace(/\/$/, ''),
      kibanaHeaders: requestHeaders,
      username: apiKey ? undefined : username,
      password: apiKey ? undefined : password,
      apiKey,
    };
  } catch (error) {
    throw new Error(
      `Could not connect to Kibana. ${error.message} \n If your Kibana URL differs, consider using '--kibana' parameter to customize it. \n`
    );
  }
}

async function discoverTargetFromKibanaUrl(kibanaUrl: string) {
  const suspectedParsedTargetUrl = parse(getTargetUrlFromKibana(kibanaUrl));

  let targetAuth = suspectedParsedTargetUrl.auth;
  let targetProtocol = suspectedParsedTargetUrl.protocol;
  const urlWithSwitchedProtocol = parse(
    format({
      ...suspectedParsedTargetUrl,
      protocol: suspectedParsedTargetUrl.protocol === 'https:' ? 'http:' : 'https:',
    })
  );
  const errorMessages = `Could not discover Elasticsearch URL based on Kibana URL ${stripAuthIfCi(
    kibanaUrl
  )}.`;

  if (!targetAuth) {
    try {
      targetAuth = await discoverAuth(suspectedParsedTargetUrl);
      targetProtocol = suspectedParsedTargetUrl.protocol;
    } catch (_error) {
      try {
        // Retry with switched protocol
        targetAuth = await discoverAuth(urlWithSwitchedProtocol);
        targetProtocol = urlWithSwitchedProtocol.protocol;
      } catch (error) {
        throw new Error(`${errorMessages} ${error.message}`);
      }
    }
  } else {
    const status = await getFetchStatus(format(suspectedParsedTargetUrl));
    const statusWithSwitchedProtocol = await getFetchStatus(format(urlWithSwitchedProtocol));
    if (status === 0 && statusWithSwitchedProtocol !== 0) {
      targetProtocol = urlWithSwitchedProtocol.protocol;
    }

    if (status === 0 && statusWithSwitchedProtocol === 0) {
      throw new Error(errorMessages);
    }
  }

  return stripTrailingSlash(
    format({
      ...suspectedParsedTargetUrl,
      auth: targetAuth,
      protocol: targetProtocol,
    })
  );
}

interface ElasticsearchConfig {
  hosts?: string | string[];
  username?: string;
  password?: string;
}

function discoverTargetFromKibanaConfig() {
  const config = readKibanaConfig();
  const esConfig = config.elasticsearch as ElasticsearchConfig | undefined;
  const hosts = esConfig?.hosts;
  let username = esConfig?.username;
  if (username === 'kibana_system_user') {
    username = 'elastic';
  }
  const password = esConfig?.password;
  if (hosts) {
    const parsed = parse(Array.isArray(hosts) ? hosts[0] : hosts);
    return format({
      ...parsed,
      auth: parsed.auth || (username && password ? `${username}:${password}` : undefined),
    });
  }
}

function getTargetUrlFromKibana(kibanaUrl: string) {
  const url = new URL(kibanaUrl);
  url.pathname = '';
  url.search = '';
  url.hash = '';

  const kbToEs = stripTrailingSlash(url.toString()).replace('.kb', '.es');

  // If url contains localhost, replace 5601 with 9200
  if (kbToEs.includes('localhost') || kbToEs.includes('127.0.0.1')) {
    return kbToEs.replace(':5601', ':9200');
  }

  return kbToEs;
}

function getKibanaUrlFromTarget(target: string) {
  const url = new URL(target);
  url.pathname = '';
  url.search = '';
  url.hash = '';

  const esToKb = stripTrailingSlash(url.toString()).replace('.es', '.kb');
  // If url contains localhost, replace 9200 with 5601
  if (esToKb.includes('localhost') || esToKb.includes('127.0.0.1')) {
    return esToKb.replace(':9200', ':5601');
  }

  return esToKb;
}

function logCertificateWarningsIfNeeded(parsedTarget: Url, parsedKibanaUrl: Url, logger: Logger) {
  if (
    (parsedTarget.protocol === 'https:' || parsedKibanaUrl.protocol === 'https:') &&
    (parsedTarget.hostname === '127.0.0.1' || parsedKibanaUrl.hostname === '127.0.0.1')
  ) {
    logger.warning(
      `WARNING: Self-signed certificate may not work with hostname: '127.0.0.1'. Consider using 'localhost' instead.`
    );
  }
}

export async function getServiceUrls({
  logger,
  target,
  kibana,
  apiKey,
}: RunOptions & { logger: Logger }) {
  if (kibana) {
    kibana = normalizeKibanaBaseUrl(kibana);
  }

  if (!target) {
    target = discoverTargetFromKibanaConfig();
    if (!kibana) {
      kibana = 'http://localhost:5601';
      logger.debug(`No target provided, defaulting Kibana to ${kibana}`);
    }
    if (!target) {
      target = await discoverTargetFromKibanaUrl(kibana);
    }
  }

  const parsedTarget = parse(target);

  let auth = parsedTarget.auth;
  let esHeaders;

  if (apiKey) {
    esHeaders = getApiKeyHeader(apiKey);
  } else if (!auth) {
    auth = await discoverAuth(parsedTarget);
  }

  const formattedEsUrl = stripTrailingSlash(
    format({
      ...parsedTarget,
      auth,
    })
  );

  let targetKibanaUrl = kibana || getKibanaUrlFromTarget(formattedEsUrl);
  const parsedKibanaUrl = parse(targetKibanaUrl);

  if (!apiKey) {
    targetKibanaUrl = format({
      ...parsedKibanaUrl,
      auth,
    });
  }

  const { kibanaUrl, kibanaHeaders, username, password } = await getKibanaUrl({
    targetKibanaUrl,
    apiKey,
    logger,
  });

  logCertificateWarningsIfNeeded(parsedTarget, parsedKibanaUrl, logger);

  return {
    kibanaUrl,
    esUrl: formattedEsUrl,
    kibanaHeaders,
    esHeaders,
    username,
    password,
    apiKey,
  };
}
