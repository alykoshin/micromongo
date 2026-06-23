/**
 * Comparison postOperators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin.
 *
 * Field-level: dispatched inside a field's sub-query, so they register into the
 * 'post' table. Range operators are array-aware (match if ANY element satisfies,
 * per Mongo). $eq/$in reuse the array "contains or equals" helpers.
 */

'use strict';

var dbg = require('../debug');
var DEBUG = dbg.DEBUG;
var debug = dbg.debug;

var assert = require('assert');

var registry = require('../registry');
var h = require('../helpers');


registry.registerOperator('post', '$eq', function (doc, query) {
  if (DEBUG) debug('$eq: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  if (Array.isArray(doc)) {
    if (Array.isArray(query))  {
      // check if arrays are the same or one of the elements
      // in `doc`'s array is same as `query` array
      return h._arrayEqlOrElementEql(doc, query, { sameOrder: true });
    } else {
      // check if array in `doc` contains element
      return h._containsAnyDeep(doc, [query], {});
    }
  } else {
    return h._eql(doc, query);
  }
});

registry.registerOperator('post', '$ne', function (doc, query) {
  if (DEBUG) debug('$ne: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  return doc !== query;
});

registry.registerOperator('post', '$gt', function (doc, query) {
  if (DEBUG) debug('$gt: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  // Against an array field, match if ANY element satisfies (Mongo semantics).
  if (Array.isArray(doc)) { return doc.some(function(el) { return el > query; }); }
  return doc > query;
});

registry.registerOperator('post', '$gte', function (doc, query) {
  if (DEBUG) debug('$gte: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  if (Array.isArray(doc)) { return doc.some(function(el) { return el >= query; }); }
  return doc >= query;
});

registry.registerOperator('post', '$lt', function (doc, query) {
  if (DEBUG) debug('$lt: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  if (Array.isArray(doc)) { return doc.some(function(el) { return el < query; }); }
  return doc < query;
});

registry.registerOperator('post', '$lte', function (doc, query) {
  if (DEBUG) debug('$lte: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  if (Array.isArray(doc)) { return doc.some(function(el) { return el <= query; }); }
  return doc <= query;
});

registry.registerOperator('post', '$in', function (doc, query) {
  if (DEBUG) debug('$in(): doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $in must be array.');
  var q = query;
  if (Array.isArray(doc)) {
    return h._containsAnyDeep(doc, q, { regex: true });
  } else {
    return (q.indexOf(doc) >= 0);
  }
});

registry.registerOperator('post', '$nin', function (doc, query) {
  assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $nin must be array.');
  var q = query;
  return (q.indexOf(doc) < 0);
});
