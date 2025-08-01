/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { FunctionComponent } from 'react';
import {
  EuiFieldText,
  EuiFormRow,
  EuiSpacer,
  EuiIcon,
  EuiToolTip,
  EuiLink,
  EuiText,
  EuiSuperSelect,
} from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';
import { PainlessContext } from '@kbn/monaco';

import { CodeEditor } from '@kbn/code-editor';
import { painlessContextOptions } from '../../constants';
import { useAppContext } from '../../context';

export const ContextTab: FunctionComponent = () => {
  const {
    store: { payload, validation },
    updatePayload,
    links,
  } = useAppContext();
  const { context, document, index, query } = payload;

  return (
    <>
      <EuiSpacer size="m" />
      <EuiFormRow
        label={
          <EuiToolTip
            content={i18n.translate('xpack.painlessLab.contextFieldTooltipText', {
              defaultMessage: 'Different contexts provide different functions on the ctx object',
            })}
          >
            <span>
              <FormattedMessage
                id="xpack.painlessLab.contextFieldLabel"
                defaultMessage="Execution context"
              />{' '}
              <EuiIcon type="question" color="subdued" />
            </span>
          </EuiToolTip>
        }
        labelAppend={
          <EuiText size="xs">
            <EuiLink href={links.painlessExecuteAPIContexts} target="_blank">
              {i18n.translate('xpack.painlessLab.contextFieldDocLinkText', {
                defaultMessage: 'Context docs',
              })}
            </EuiLink>
          </EuiText>
        }
        fullWidth
      >
        <EuiSuperSelect
          options={painlessContextOptions}
          valueOfSelected={context}
          onChange={(nextContext: PainlessContext) => updatePayload({ context: nextContext })}
          itemLayoutAlign="top"
          hasDividers
          fullWidth
          data-test-subj="painlessContextDropDown"
        />
      </EuiFormRow>

      {['filter', 'score'].indexOf(context) !== -1 && (
        <EuiFormRow
          label={
            <EuiToolTip
              content={i18n.translate('xpack.painlessLab.indexFieldTooltipText', {
                defaultMessage: `Index mappings must be compatible with the sample document's fields`,
              })}
            >
              <span>
                <FormattedMessage
                  id="xpack.painlessLab.indexFieldLabel"
                  defaultMessage="Index name"
                />{' '}
                <EuiIcon type="question" color="subdued" />
              </span>
            </EuiToolTip>
          }
          fullWidth
          isInvalid={!validation.fields.index}
          error={
            validation.fields.index
              ? []
              : [
                  i18n.translate('xpack.painlessLab.indexFieldMissingErrorMessage', {
                    defaultMessage: 'Enter an index name',
                  }),
                ]
          }
        >
          <EuiFieldText
            fullWidth
            value={index || ''}
            onChange={(e) => {
              const nextIndex = e.target.value;
              updatePayload({ index: nextIndex });
            }}
            isInvalid={!validation.fields.index}
          />
        </EuiFormRow>
      )}
      {/* Query DSL Code Editor */}
      {'score'.indexOf(context) !== -1 && (
        <EuiFormRow
          label={
            <EuiToolTip
              content={i18n.translate('xpack.painlessLab.queryFieldTooltipText', {
                defaultMessage:
                  'Use query to specify that that _score will be used to calculate score.',
              })}
            >
              <span>
                <FormattedMessage id="xpack.painlessLab.queryFieldLabel" defaultMessage="Query" />{' '}
                <EuiIcon type="question" color="subdued" />
              </span>
            </EuiToolTip>
          }
          labelAppend={
            <EuiText size="xs">
              <EuiLink href={links.esQueryDSL} target="_blank">
                {i18n.translate('xpack.painlessLab.queryFieldDocLinkText', {
                  defaultMessage: 'Query DSL docs',
                })}
              </EuiLink>
            </EuiText>
          }
          fullWidth
        >
          <CodeEditor
            languageId="json"
            height={150}
            value={query}
            onChange={(nextQuery) => updatePayload({ query: nextQuery })}
            options={{
              fontSize: 12,
              minimap: {
                enabled: false,
              },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              wrappingIndent: 'indent',
              automaticLayout: true,
            }}
          />
        </EuiFormRow>
      )}
      {['filter', 'score'].indexOf(context) !== -1 && (
        <EuiFormRow
          label={
            <EuiToolTip
              content={i18n.translate('xpack.painlessLab.documentFieldTooltipText', {
                defaultMessage: "Your script can access this document's fields",
              })}
            >
              <span>
                <FormattedMessage
                  id="xpack.painlessLab.documentFieldLabel"
                  defaultMessage="Sample document (JSON)"
                />{' '}
                <EuiIcon type="question" color="subdued" />
              </span>
            </EuiToolTip>
          }
          fullWidth
        >
          <CodeEditor
            languageId="json"
            height={400}
            value={document}
            onChange={(nextDocument) => updatePayload({ document: nextDocument })}
            options={{
              fontSize: 12,
              minimap: {
                enabled: false,
              },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              wrappingIndent: 'indent',
              automaticLayout: true,
            }}
          />
        </EuiFormRow>
      )}
    </>
  );
};
