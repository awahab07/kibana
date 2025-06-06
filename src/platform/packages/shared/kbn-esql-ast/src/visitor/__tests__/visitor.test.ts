/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { parse } from '../../parser';
import { ESQLAstQueryExpression } from '../../types';
import { CommandVisitorContext, WhereCommandVisitorContext } from '../contexts';
import { Visitor } from '../visitor';

test('can collect all command names in type safe way', () => {
  const visitor = new Visitor()
    .on('visitCommand', (ctx) => {
      return ctx.node.name;
    })
    .on('visitQuery', (ctx) => {
      const cmds = [];
      for (const cmd of ctx.visitCommands()) {
        cmds.push(cmd);
      }
      return cmds;
    });

  const { ast } = parse('FROM index | LIMIT 123');
  const res = visitor.visitQuery(ast);

  expect(res).toEqual(['from', 'limit']);
});

test('can pass inputs to visitors', () => {
  const visitor = new Visitor()
    .on('visitCommand', (ctx, prefix: string) => {
      return prefix + ctx.node.name;
    })
    .on('visitQuery', (ctx) => {
      const cmds = [];
      for (const cmd of ctx.visitCommands('pfx:')) {
        cmds.push(cmd);
      }
      return cmds;
    });

  const { ast } = parse('FROM index | LIMIT 123');
  const res = visitor.visitQuery(ast);

  expect(res).toEqual(['pfx:from', 'pfx:limit']);
});

test('a query can have a parent fork command', () => {
  const { ast } = parse('FROM index | FORK (WHERE 1) (WHERE 2)');

  let parentCount = 0;
  new Visitor()
    .on('visitCommand', (ctx) => {
      if (ctx.node.name === 'fork') {
        ctx.node.args.forEach((subQuery) => ctx.visitSubQuery(subQuery as ESQLAstQueryExpression));
      }
    })
    .on('visitQuery', (ctx) => {
      if (ctx.parent) parentCount++;

      for (const _cmdResult of ctx.visitCommands()) {
        // nothing
      }
    })
    .visitQuery(ast);

  expect(parentCount).toBe(2);
});

test('can specify specific visitors for commands', () => {
  const { ast } = parse('FROM index | SORT asfd | WHERE 1 | ENRICH adsf | LIMIT 123');
  const res = new Visitor()
    .on('visitWhereCommand', () => 'where')
    .on('visitSortCommand', () => 'sort')
    .on('visitEnrichCommand', () => 'very rich')
    .on('visitCommand', () => 'DEFAULT')
    .on('visitQuery', (ctx) => [...ctx.visitCommands()])
    .visitQuery(ast);

  expect(res).toEqual(['DEFAULT', 'sort', 'where', 'very rich', 'DEFAULT']);
});

test('a command can access parent query node', () => {
  const { root } = parse('FROM index | SORT asfd | WHERE 1 | ENRICH adsf | LIMIT 123');
  new Visitor()
    .on('visitWhereCommand', (ctx) => {
      if (ctx.parent!.node !== root) {
        throw new Error('Expected parent to be query node');
      }
    })
    .on('visitCommand', (ctx) => {
      if (ctx.parent!.node !== root) {
        throw new Error('Expected parent to be query node');
      }
    })
    .on('visitQuery', (ctx) => [...ctx.visitCommands()])
    .visitQuery(root);
});

test('specific commands receive specific visitor contexts', () => {
  const { root } = parse('FROM index | SORT asfd | WHERE 1 | ENRICH adsf | LIMIT 123');

  new Visitor()
    .on('visitWhereCommand', (ctx) => {
      if (!(ctx instanceof WhereCommandVisitorContext)) {
        throw new Error('Expected WhereCommandVisitorContext');
      }
      if (!(ctx instanceof CommandVisitorContext)) {
        throw new Error('Expected WhereCommandVisitorContext');
      }
    })
    .on('visitCommand', (ctx) => {
      if (!(ctx instanceof CommandVisitorContext)) {
        throw new Error('Expected CommandVisitorContext');
      }
    })
    .on('visitQuery', (ctx) => [...ctx.visitCommands()])
    .visitQuery(root);

  new Visitor()
    .on('visitCommand', (ctx) => {
      if (!(ctx instanceof CommandVisitorContext)) {
        throw new Error('Expected CommandVisitorContext');
      }
      if (ctx instanceof WhereCommandVisitorContext) {
        throw new Error('Did not expect WhereCommandVisitorContext');
      }
    })
    .on('visitQuery', (ctx) => [...ctx.visitCommands()])
    .visitQuery(root);
});
