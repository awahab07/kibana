/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useLayoutEffect } from 'react';
import classNames from 'classnames';
import { CoreStart } from '@kbn/core/public';
import { IInterpreterRenderHandlers } from '@kbn/expressions-plugin/common';
import type { PersistedState } from '@kbn/visualizations-plugin/public';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { euiScrollBarStyles, type UseEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import { useMemoCss } from '@kbn/css-utils/public/use_memo_css';
import { TableVisConfig, TableVisData } from '../types';
import { TableVisBasic } from './table_vis_basic';
import { TableVisSplit } from './table_vis_split';
import { useUiState } from '../utils';

const tableVisualizationStyles = {
  base: (euiThemeContext: UseEuiTheme) => css`
    display: flex;
    flex-direction: column;
    flex: 1 0 0;
    overflow: auto;

    ${euiScrollBarStyles(euiThemeContext)}
  `,
  splitColumns: css({
    flexDirection: 'row',
    alignItems: 'flex-start',
  }),
};
interface TableVisualizationComponentProps {
  core: CoreStart;
  handlers: IInterpreterRenderHandlers;
  renderComplete: () => void;
  visData: TableVisData;
  visConfig: TableVisConfig;
}

const TableVisualizationComponent = ({
  core,
  handlers,
  visData: { direction, table, tables },
  visConfig,
  renderComplete,
}: TableVisualizationComponentProps) => {
  const styles = useMemoCss(tableVisualizationStyles);
  useLayoutEffect(() => {
    // Temporary solution: DataGrid should provide onRender callback
    setTimeout(() => {
      renderComplete();
    }, 300);
  }, [renderComplete]);

  const uiStateProps = useUiState(handlers.uiState as PersistedState);

  const hasColumnDirection = direction === 'column';

  const className = classNames('tbvChart', {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    tbvChart__splitColumns: hasColumnDirection,
  });

  return (
    <core.i18n.Context>
      <KibanaContextProvider services={core}>
        <div
          className={className}
          data-test-subj="tbvChart"
          css={[styles.base, hasColumnDirection && styles.splitColumns]}
        >
          {table ? (
            <TableVisBasic
              fireEvent={handlers.event}
              table={table}
              visConfig={visConfig}
              uiStateProps={uiStateProps}
            />
          ) : (
            <TableVisSplit
              fireEvent={handlers.event}
              tables={tables}
              visConfig={visConfig}
              uiStateProps={uiStateProps}
              enforceMinWidth={direction === 'column'}
            />
          )}
        </div>
      </KibanaContextProvider>
    </core.i18n.Context>
  );
};

// default export required for React.Lazy
// eslint-disable-next-line import/no-default-export
export { TableVisualizationComponent as default };
