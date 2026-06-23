/**
 * Operator registry — the single source of truth for match operators.
 *
 * Operators are split into three tables by WHEN they run (unchanged from the
 * original match.js design):
 *   - preOperators  : logical, evaluated against the whole document
 *                     ($and / $or / $nor / $where / $text)
 *   - postOperators : field-level comparison / element / array / geo / bitwise
 *                     ($eq / $gt / $in / $type / $regex / $all / $elemMatch / …)
 *   - preprocessOps : run once in prepareQuery() before matching ($comment)
 *
 * These tables ARE the public extension point. The blessed way to add an
 * operator is `registerOperator(kind, name, fn)` (re-exported as
 * `mm.registerOperator`). The tables themselves are exported (for dispatch and
 * for tests that pull a built-in off them), but external code should register
 * through the function, not mutate the maps directly.
 */

'use strict';

var preOperators: any = {};
var postOperators: any = {};
var preprocessOps: any = {};

var TABLES: any = {
  pre: preOperators,
  post: postOperators,
  preprocess: preprocessOps,
};

/**
 * Register a match operator. This is the supported way to extend micromongo's
 * query engine (replacing the old "assign to mm._crud._match.postOperators"
 * pattern).
 *
 * @param kind - which dispatch table to add to:
 *        'pre' = logical, whole-document operator (used at the top level);
 *        'post' = field-level operator (used inside a field's sub-query);
 *        'preprocess' = run once before matching (side-effect only, e.g. $comment).
 * @param name - the operator key, including the leading '$'.
 * @param fn - (doc, query, options, siblings) => boolean
 * @returns fn (for convenience/chaining)
 */
function registerOperator(kind: 'pre' | 'post' | 'preprocess', name: string, fn: Function): Function {
  var table = TABLES[kind];
  if (!table) {
    throw new Error("registerOperator(kind, name, fn): kind must be 'pre', 'post' or 'preprocess', got " + JSON.stringify(kind));
  }
  if (typeof name !== 'string' || name.charAt(0) !== '$') {
    throw new TypeError("registerOperator: name must be a string starting with '$', got " + JSON.stringify(name));
  }
  if (typeof fn !== 'function') {
    throw new TypeError('registerOperator: fn must be a function');
  }
  table[name] = fn;
  return fn;
}

export = {
  preOperators: preOperators,
  postOperators: postOperators,
  preprocessOps: preprocessOps,
  registerOperator: registerOperator,
};
