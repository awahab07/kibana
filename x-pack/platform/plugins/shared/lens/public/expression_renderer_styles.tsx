/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { UseEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';

/**
 * Font stack for Lens charts with enhanced numeric rendering.
 *
 * "Elastic UI Numeric" is a derivative font with OpenType features (tnum, zero, ss01, ss07)
 * baked into the default glyphs. Using unicode-range, it only applies to numeric characters,
 * while letters fall through to the standard Inter font.
 *
 * This approach works on all browsers including Firefox's canvas implementation, which does not
 * support CSS font-feature-settings for canvas text rendering.
 *
 * @see https://github.com/elastic/kibana/issues/249382
 */
const chartsNumericFontStyles = ({ euiTheme }: UseEuiTheme) => css`
  font-family: 'Elastic UI Numeric', ${euiTheme.font.family};

  // Override user agent styles for form elements
  button,
  input,
  select,
  textarea {
    font-family: inherit;
  }
`;

export const lnsExpressionRendererStyle = (euiThemeContext: UseEuiTheme) => {
  return css`
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    overflow: auto;
    ${chartsNumericFontStyles(euiThemeContext)}
  `;
};

/**
 * Global styles for elastic-charts elements rendered via portals (tooltips, annotations).
 * These elements are rendered outside the Lens DOM tree and need global targeting.
 */
export const lnsGlobalChartStyles = (euiThemeContext: UseEuiTheme) => css`
  [id^='echTooltipPortal'] {
    ${chartsNumericFontStyles(euiThemeContext)}
  }
`;
