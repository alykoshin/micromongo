/**
 * The core query engine — public facade.
 *
 * This module was split out of the original single-file `lib/crud/match.js` into
 * `lib/crud/match/` for modularity (Phase 9). The split is purely structural;
 * matching behavior is unchanged. The pieces:
 *
 *   registry.js   — the operator tables (pre/post/preprocess) + registerOperator()
 *   helpers.js    — _eql, _contains, the _array... family, _bits..., geo helpers
 *   engine.js     — dispatch + the mutually-recursive match()/_match1/doExpr
 *   operators/    — built-in operators, each self-registering into the registry
 *   debug.js      — the shared DEBUG trace toggle
 *
 * Requiring this module loads every operator module (so the built-ins register
 * themselves) and re-assembles the SAME public shape the old file exported:
 * a callable `match(doc, query)` with `.prepareQuery`, `.preOperators`,
 * `.postOperators`, `.projectionOps`, `._eql`, `._arrayEqlOrElementEql` —
 * plus the new `.registerOperator` (the blessed extension point).
 *
 * Adding a query operator: call `registerOperator(kind, name, fn)` (exposed as
 * `mm.registerOperator`), or add a module under `operators/` that does so and
 * require it here. New MongoDB operators still need a `-mongodoc.js` test.
 *
 * TS shape: `export = match` (the callable IS the module) typed as a `MatchFn`
 * interface (call signature + the attached statics) — the same pattern proven in
 * project.ts. Under `module:commonjs` this re-emits `module.exports = match` with
 * `module.exports.prepareQuery = …` etc., identical to the old CJS tail.
 */

'use strict';

import type { Query, MatchOperatorFn } from '../../types';

var registry = require('./registry');
var helpers = require('./helpers');
var engine = require('./engine');

// Load built-in operators — each self-registers into the registry tables.
require('./operators/logical');
require('./operators/expr');
require('./operators/comparison');
require('./operators/element');
require('./operators/evaluation');
require('./operators/array');
require('./operators/not');
require('./operators/geo');
require('./operators/bitwise');
require('./operators/preprocess');

// Projection operators are NOT handled here. The specialized projection
// operators micromongo supports — $slice, $elemMatch, and positional $ — live in
// lib/crud/project.js. This table is kept (empty) only for the historical export
// shape; it was dead code in the original file.
var projectionOps: Record<string, any> = {};


/**
 * The module surface: the callable matcher plus the statics that mirror the
 * original single-file `match.js` export exactly.
 */
interface MatchFn {
  (doc: any, query: any): any;
  prepareQuery: (query: Query) => Query;
  preOperators: Record<string, MatchOperatorFn>;
  postOperators: Record<string, MatchOperatorFn>;
  preprocessOps: Record<string, MatchOperatorFn>;
  projectionOps: Record<string, any>;
  registerOperator: (kind: any, name: any, fn: any) => any;
  _eql: (a: any /* value */, b: any /* value */) => boolean;
  _arrayEqlOrElementEql: (...args: any[]) => boolean;
}

// The default export is the callable matcher; the rest hangs off it, mirroring
// the original module's surface exactly.
var match = engine.match as MatchFn;

match.prepareQuery = engine.prepareQuery;
match.preOperators = registry.preOperators;
match.postOperators = registry.postOperators;
match.preprocessOps = registry.preprocessOps;
match.projectionOps = projectionOps;
match.registerOperator = registry.registerOperator;
match._eql = helpers._eql;
match._arrayEqlOrElementEql = helpers._arrayEqlOrElementEql;

export = match;
