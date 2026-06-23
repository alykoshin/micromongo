/**
 * Logical / whole-document preOperators: $text, $and, $or, $nor, $where.
 *
 * These are dispatched at the TOP LEVEL of a query (against the whole document),
 * so they register into the 'pre' table. $and/$or/$nor recurse via engine._match1;
 * $text stashes a relevance score for a later $meta projection; $where runs user
 * code in a vm sandbox with the configured timeout.
 */

'use strict';

var assert = require('assert');
var vm = require('vm');

var dbg = require('../debug');
var DEBUG = dbg.DEBUG;
var debug = dbg.debug;

var settings = require('../../../settings');
var textSearch = require('../../text');

var registry = require('../registry');
var engine = require('../engine');


// $text matches the WHOLE document (all string fields). `query` is the operand,
// e.g. { $search: "coffee shop" }. The relevance score is stashed (keyed by the
// document) so a $meta:"textScore" projection can retrieve it.
registry.registerOperator('pre', '$text', function (doc: any, query: any) {
  if (!query || typeof query.$search !== 'string') {
    throw new Error('$text requires { $search: <string> }');
  }
  var res = textSearch(doc, query.$search);
  if (res.match) { textSearch.setScore(doc, res.score); }
  return res.match;
});

registry.registerOperator('pre', '$and', function (this: any, doc: any, query: any) {
  if (DEBUG) debug('$and: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $and must be array.');
  // iterate the array
  for (var len=query.length, i=0; i<len; ++i) {
    var q1 = query[i];
    var res = engine._match1.call(this, doc, q1);
    if (DEBUG) debug('$and: q1: ' + JSON.stringify(q1) + ', res: ' +JSON.stringify(res));
    if (!res) {
      return false;
    }
  }
  return true;
});

registry.registerOperator('pre', '$or', function (this: any, doc: any, query: any) {
  if (DEBUG) debug('$or: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $or must be array.');
  // iterate the array
  for (var len=query.length, i=0; i<len; ++i) {
    var q1 = query[i];
    var res = engine._match1.call(this, doc, q1);
    if (DEBUG) debug('$or: q1:', q1, ', res', res);
    if (res) {
      return true;
    }
  }
  return false;
});

registry.registerOperator('pre', '$nor', function (this: any, doc: any, query: any) {
  assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $nor must be array.');
  // iterate the array
  for (var len=query.length, i=0; i<len; ++i) {
    var q1 = query[i];
    var res = engine._match1.call(this, doc, q1);
    if (res) {
      return false;
    }
  }
  return true;
});

registry.registerOperator('pre', '$where', function (this: any, doc: any, query: any) {

  var sandbox = { this: this, obj: this };
  vm.createContext(sandbox);

  var script;
  var fn;
  if (typeof query === 'string') {
    fn =
      'function() { ' +
      '  return ' + query + '' +
      '}';

  } else if (typeof query === 'function') {
    fn = query.toString();

  } else {
    throw new TypeError('Invalid syntax near \'' + JSON.stringify(query) + '\': parameter for $where must be string or function.');
  }

  var code =
        '(' +
        fn +
        ').call(this.this)';

  // Read at use so `mm.configure({ whereTimeout })` takes effect.
  var WHERE_TIMEOUT = settings.whereTimeout;
  script = new vm.Script(code, { timeout: WHERE_TIMEOUT });

  return script.runInContext(sandbox);
});
