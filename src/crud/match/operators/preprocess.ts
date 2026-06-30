/**
 * Preprocess operators: $comment.
 *
 * Preprocess operators run ONCE in engine.prepareQuery() before matching begins
 * (side-effect only), and are skipped during the per-document match. They
 * register into the 'preprocess' table.
 */

'use strict';

var registry = require('../registry');


registry.registerOperator('preprocess', '$comment', function (doc: any /* value */, query: any /* value (operand) */) {
  console.log(query);
  return query;
});
