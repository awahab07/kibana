/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiEmptyPrompt } from '@elastic/eui';
import React from 'react';
import styled from '@emotion/styled';
import {
  missingMlPrivilegesTitle,
  missingMlResultsPrivilegesDescription,
} from './missing_privileges_messages';
import { UserManagementLink } from './user_management_link';

export const MissingResultsPrivilegesPrompt: React.FunctionComponent = () => (
  <EmptyPrompt
    data-test-subj="logsMissingMLReadPrivileges"
    title={<h2>{missingMlPrivilegesTitle}</h2>}
    body={<p>{missingMlResultsPrivilegesDescription}</p>}
    actions={<UserManagementLink />}
  />
);

const EmptyPrompt = styled(EuiEmptyPrompt)`
  align-self: center;
`;
