/**
 * Logical / whole-document preOperators: $text, $and, $or, $nor, $where.
 *
 * These are dispatched at the TOP LEVEL of a query (against the whole document),
 * so they register into the 'pre' table. $and/$or/$nor recurse via engine._match1;
 * $text stashes a relevance score for a later $meta projection; $where runs user
 * code in a vm sandbox with the configured timeout.
 */

'use strict';

var assert = require('../../../assert');

var dbg = require('../debug');
var DEBUG = dbg.DEBUG;
var debug = dbg.debug;

var settings = require('../../../settings');
var textSearch = require('../../text');

var registry = require('../registry');
var engine = require('../engine');

import type { Document } from '../../../types';


// $text matches the WHOLE document (all string fields). `query` is the operand,
// e.g. { $search: "coffee shop" }. The relevance score is stashed (keyed by the
// document) so a $meta:"textScore" projection can retrieve it.
registry.registerOperator('pre', '$text', function (doc: Document, query: any /* value (operand) */) {
  if (!query || typeof query.$search !== 'string') {
    throw new Error('$text requires { $search: <string> }');
  }
  var res = textSearch(doc, query.$search);
  if (res.match) { textSearch.setScore(doc, res.score); }
  return res.match;
});

registry.registerOperator('pre', '$and', function (this: any, doc: Document, query: any /* values (sub-queries) */) {
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

registry.registerOperator('pre', '$or', function (this: any, doc: Document, query: any /* values (sub-queries) */) {
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

registry.registerOperator('pre', '$nor', function (this: any, doc: Document, query: any /* values (sub-queries) */) {
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

/**
 * `$where` — run a user-supplied JS expression/function against each document
 * (the doc is bound as `this`/`obj`). Mirrors MongoDB's `$where`.
 *
 * A **function** operand is called directly (`query.call(doc)`) — no `vm` for the
 * common `function () { return this.x }` shape; it falls back to the `vm` path only
 * if the function references the free variable `obj` (which a direct call can't bind).
 * A **string** operand is evaluated in the `vm` (the only way to run JS from text).
 *
 * ⚠️ SECURITY: this executes arbitrary JavaScript. The Node `vm` used below is
 * **NOT a security sandbox** — Node's own docs say so, and the classic
 * `this.constructor.constructor('return process')()` escape reaches the host
 * (fs/network/child_process). The `timeout` only stops *synchronous* runaway
 * loops, not escapes. So `$where` is **trusted-input-only**: only pass it queries
 * your own code constructs — never a `$where` string built from end-user input.
 * (This is the same posture as real MongoDB, which disables server-side JS by
 * default.) For *computed* queries from untrusted input, prefer the safe path —
 * `$expr` with the aggregation expression evaluator (planned) — which runs no JS.
 */
registry.registerOperator('pre', '$where', function (this: any, doc: Document, query: any /* value (string|function) */) {

  var self = this; // the matched document (bound as `this` by the engine)

  // Run a stringified function body in a `vm` context where the document is bound
  // as both `this` and the free variable `obj` (Mongo's two ways to reach the doc),
  // with the configured timeout. Used for string `$where`, and as the fallback for a
  // function operand that references the free `obj` (which a direct call can't supply).
  // `whereTimeout` is read at use so `mm.configure({ whereTimeout })` takes effect.
  var runInVm = function (fnSource: string): any {
    // Lazy-require `vm` at first use, not at module load, so this engine module
    // imports cleanly in non-Node runtimes (the browser build never references `vm`
    // unless string `$where` actually runs — a Node-only feature). The browser build
    // swaps this evaluator for a `new Function` variant (see the multi-target plan).
    var vm = require('vm');
    var sandbox = { this: self, obj: self };
    vm.createContext(sandbox);
    var code = '(' + fnSource + ').call(this.this)';
    var script = new vm.Script(code, { timeout: settings.whereTimeout });
    return script.runInContext(sandbox);
  };

  // FUNCTION form — call the live function directly with the doc bound as `this`.
  // No `vm` needed for the common `function () { return this.x }` shape (faster, and
  // browser-clean). A function that instead references the free variable `obj`
  // (`function () { return obj.x }`) throws a ReferenceError on a direct call — its
  // `obj` only resolves in the vm sandbox scope — so fall back to `runInVm` for that.
  if (typeof query === 'function') {
    try {
      return query.call(self);
    } catch (e) {
      if (e instanceof ReferenceError) { return runInVm(query.toString()); }
      throw e;
    }
  }

  // STRING form — wrap as `function () { return <expr> }` and evaluate in the vm.
  if (typeof query === 'string') {
    return runInVm('function () { return ' + query + '; }');
  }

  throw new TypeError('Invalid syntax near \'' + JSON.stringify(query) + '\': parameter for $where must be string or function.');
});
