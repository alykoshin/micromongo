/**
 * Match-engine dispatch & recursion.
 *
 * A document matches a query through mutual recursion:
 *   match() -> _match0 (implicit $where when query is string/function)
 *           -> _match1 (top level: dispatch logical preOperators and field names)
 *           -> doExpr  (per field: dispatch $-postOperators vs nested field paths)
 *
 * Operators are looked up in the shared registry tables AT CALL TIME, so any
 * operator registered (via registerOperator) before a query runs is visible —
 * including user-added ones. The operator modules require this engine for the
 * recursion entry points (_match1 / doExpr) and register themselves into the
 * registry; this engine does NOT require the operator modules, so there is no
 * circular dependency (operators are wired in by lib/crud/match/index.js).
 */

'use strict';

var get = require('lodash/get');
var isEmpty = require('lodash/isEmpty');
var isBuffer = require('../../utils').isBuffer;


import type { Document, Query } from '../../types';

var dbg = require('./debug');
var DEBUG = dbg.DEBUG;
var debug = dbg.debug;

var registry = require('./registry');
var preOperators = registry.preOperators;
var postOperators = registry.postOperators;
var preprocessOps = registry.preprocessOps;


function doPreOp(this: any, doc: Document, op: string, subQuery: any /* value */, options: any /* value */): boolean {
  if (typeof preOperators[ op ] === 'undefined') { // execute it
    throw new Error('Invalid operator \''+JSON.stringify(op));
  }
  return preOperators[ op ].call(this, doc, subQuery, options);
}

function doPostOp(this: any, doc: any /* value */, op: string, subQuery: any /* value */, options?: any /* value */, siblings?: any /* value */): boolean {
  if (DEBUG) debug('doPostOp(): doc: '+JSON.stringify(doc)+', op:'+JSON.stringify(op)+', subQuery:'+JSON.stringify(subQuery)+', options:'+JSON.stringify(options));
  if (typeof postOperators[ op ] === 'undefined') {
    throw new Error('Invalid operator \'' + JSON.stringify(op) + '\'.');
  }
  // `siblings` is the full operator object (e.g. { $near: …, $maxDistance: … }),
  // so operators that need their sibling keys (geo $near/$nearSphere) can read them.
  return postOperators[ op ].call(this, doc, subQuery, options, siblings); // execute it
}

function doExpr(this: any, doc: any /* value */, query: any /* value */, options?: any /* value */): boolean {
  if (DEBUG) debug('doExpr(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;
  // as this is not logical operator, this is a field name
  // check if there is an operator inside
  if (typeof query === 'object' && query!==null && !Array.isArray(query) && !isBuffer(query) ) {

    for (var k2 in query) { if (query.hasOwnProperty(k2)) {
      if (DEBUG) debug('doExpr(): k2: '+k2);

      if (k2.charAt(0) === '$') {

        if (preprocessOps[k2]) { continue; } // this is preprocess operators to be skipped here

        res = doPostOp.call(this, doc, k2, query[k2], query.$options, query);
        if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }

      } else { // this is a field name, not operator
        res = doExpr.call(this,  get(doc, k2), query[k2], query.$options);
        if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }
      }
    }}

  } else { // this is a field name, not operator
    res = doPostOp.call(this, doc, '$eq', query);
    if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }
  }
  if (DEBUG) debug('doExpr(): true (default)');
  return true;
}

function _match1(this: any, doc: Document, query: any /* value */): any /* value (scalar query echoed back) */ {
  if (DEBUG) debug('* _match1(): doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  var res;

  // if scalar (not for top-level query)
  // Array also must end the recursion
  if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null /*|| Array.isArray(query)*/) {
    return query;
  }

  // empty query returns all documents (for top-level query only)
  if (isEmpty(query)) { // this includes boolean & numbers
    return true;
  }

  // on top level we have logical preOperators ($and, $or, $not, /*$nor*/) or field list
  for (var k1 in query) { if (query.hasOwnProperty(k1)) {

    if (k1.charAt(0) === '$') { // match if it is logical operator
      if (preprocessOps[k1]) { continue; } // this is preprocess operators to be skipped here

      res = doPreOp.call(this, doc, k1, query[ k1 ], query.$options); if (!res) { return false; }

    } else {
      res = doExpr.call(this,  get(doc, k1), query[k1], query.$options); if (!res) { return false; }
    }

  }}
  return true;
}

function _match0(this: any, doc: Document, query: any /* value */): any /* value */ {
  if (DEBUG) debug('* _match0(): doc: '+ JSON.stringify(doc)+', query: '+ JSON.stringify(query));

  // handle implicit $where
  if (typeof query === 'string' || typeof query === 'function') {
    return preOperators.$where.call(this, doc, query);
  }

  return _match1.call(this, doc, query);
}

function match(doc: Document, query: Query): any /* value */ {
  if (DEBUG) debug('* match(): doc: '+ JSON.stringify(doc)+', query: '+ JSON.stringify(query));
  return _match0.call(doc, doc, query); // pass original `doc` as `this`
}

function prepareQuery(this: any, query: Query): Query {
  if (DEBUG) debug('* prepareQuery(): query: '+ JSON.stringify(query));
  for (var op in query) { if (query.hasOwnProperty(op)) {
    if (preprocessOps[op]) {
      preprocessOps[op].call(this, null, query[op]);
    }
  } }
  return query;
}


export = {
  doPreOp: doPreOp,
  doPostOp: doPostOp,
  doExpr: doExpr,
  _match1: _match1,
  _match0: _match0,
  match: match,
  prepareQuery: prepareQuery,
};
