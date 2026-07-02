/**
 * `$expr` — use an aggregation expression inside a query.
 *
 *   { $expr: { $gt: [ "$spent", "$budget" ] } }
 *
 * A top-level (`pre`) operator: the expression is evaluated against the WHOLE
 * document via the aggregation expression evaluator, and the document matches
 * when the result is truthy (Mongo's `$expr` semantics). This reuses the existing
 * evaluator ([`aggregate/expression.ts`](../../../aggregate/expression.ts)) — the
 * same engine that powers `$project`/`$group` computed fields — so every
 * expression operator (`$gt`/`$add`/`$cond`/…) works in a query for free.
 *
 * No `vm`, no arbitrary JS (unlike `$where`): `$expr` is the safe way to compare
 * fields / compute within a query.
 *
 * See https://www.mongodb.com/docs/manual/reference/operator/query/expr/ .
 */

'use strict';

var registry = require('../registry');
// The evaluator is a self-contained, dependency-light module (only lodash) — no
// circular dependency with the match engine (it never requires back into match/).
var evaluate = require('../../../aggregate/expression');

import type { Document } from '../../../types';

// See operators/bitwise.ts for the register(reg) + self-call + `export =` convention.
function register(reg: any): void {
  reg.registerOperator('pre', '$expr', function (doc: Document, query: any /* the aggregation expression */) {
    // Evaluate the expression against the whole document; match on truthiness.
    return evaluate._truthy(evaluate(query, doc));
  });
}

register(registry);
export = register;
