/**
 * Local `assert` shim — a browser-safe replacement for Node's `require('assert')`.
 *
 * The engine only ever uses the two-argument truthiness form, `assert(cond, message)`
 * (a defensive guard that throws when `cond` is falsy). Node's `assert` pulls in a Node
 * built-in that doesn't exist in the browser; this 3-line equivalent removes that
 * dependency so the match engine compiles and runs in any JS runtime. Behavior matches
 * the form we use: falsy `value` throws an `Error` whose `.message` is `message`
 * (no test depends on the `AssertionError` type — verified — only on the message text
 * via chai's `.throw(/…/)`).
 *
 * Emits `module.exports = assert` under `module:commonjs`, so `require('…/assert')`
 * resolves to the callable exactly like `require('assert')` did.
 */

'use strict';

function assert(value: any, message?: string): asserts value {
  if (!value) { throw new Error(message || 'assertion failed'); }
}

export = assert;
