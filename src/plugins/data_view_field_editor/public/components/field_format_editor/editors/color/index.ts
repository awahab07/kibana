/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { FieldFormatEditorFactory } from '../types';
import { ColorFormatEditorFormatParams } from './color';
import { formatId } from './constants';

export type { ColorFormatEditor } from './color';
export const colorFormatEditorFactory: FieldFormatEditorFactory<
  ColorFormatEditorFormatParams
> = () => import('./color').then((m) => m.ColorFormatEditor);
colorFormatEditorFactory.formatId = formatId;
