/**
 * $not — a field-level (post) operator that negates the result of its sub-query
 * against the same field value. Recurses via engine.doExpr.
 *
 * (Distinct from the logical preOperators $and/$or/$nor, which operate on the
 * whole document — see operators/logical.js.)
 */

'use strict';

var dbg = require('../debug');
var DEBUG = dbg.DEBUG;
var debug = dbg.debug;

var registry = require('../registry');
var engine = require('../engine');


registry.registerOperator('post', '$not', function (this: any, doc: any /* value */, query: any /* value (sub-expression) */) {
  if (DEBUG) debug('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  var res = ! engine.doExpr.call(this, doc, query);
  return res;
});
