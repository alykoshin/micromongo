/**
 * Array query postOperators: $all, $elemMatch, $size.
 *
 * $elemMatch recurses into each array element via engine.doExpr.
 */

'use strict';

var assert = require('../../../assert');

var registry = require('../registry');
var engine = require('../engine');
var h = require('../helpers');

import type { Query } from '../../../types';


registry.registerOperator('post', '$all', function (doc: any /* value */, query: any /* values (operand) */) {
  assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $all must be array.');
  return h._arrayOrElementContainsAll(doc, query);
});

registry.registerOperator('post', '$elemMatch', function (this: any, doc: any /* value */, query: Query) {
  if (!Array.isArray(doc)) return false;
  for (var len=doc.length, i=0; i<len; ++i) {
    var res = engine.doExpr.call(this, doc[i], query);
    if (res) return true;
  }
  return false;
});

registry.registerOperator('post', '$size', function (doc: any /* value */, query: any /* value (operand) */) {
  if ( typeof query !== 'number') {
    throw new Error('Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $size must be a number.');
  }
  return Array.isArray(doc) ? (doc.length === query) : false;
});
