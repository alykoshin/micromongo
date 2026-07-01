/**
 * Bitwise query postOperators: $bitsAllSet, $bitsAnySet, $bitsAllClear,
 * $bitsAnyClear.
 *
 * Operand forms: a numeric bitmask, or an array of bit positions (0 = least
 * significant bit). BinData masks are NOT supported. The field value must be a
 * number to match. Math lives in helpers._bitsMatch.
 */

'use strict';

var registry = require('../registry');
var h = require('../helpers');


// Register this file's operators into the given registry. Exported as the module's
// value (named, so it reads as "here is what this file registers") AND self-called on
// import with the shared registry — so `require('./operators/bitwise')` still activates
// the operators exactly as before ("loaded = registered"). Taking `reg` as a parameter
// keeps the registrar reusable (e.g. a future registerBuiltins()).
function register(reg: any): void {
  reg.registerOperator('post', '$bitsAllSet', function (doc: any /* value */, query: any /* value (operand) */) {
    return h._bitsMatch(doc, query, 'allSet');
  });

  reg.registerOperator('post', '$bitsAnySet', function (doc: any /* value */, query: any /* value (operand) */) {
    return h._bitsMatch(doc, query, 'anySet');
  });

  reg.registerOperator('post', '$bitsAllClear', function (doc: any /* value */, query: any /* value (operand) */) {
    return h._bitsMatch(doc, query, 'allClear');
  });

  reg.registerOperator('post', '$bitsAnyClear', function (doc: any /* value */, query: any /* value (operand) */) {
    return h._bitsMatch(doc, query, 'anyClear');
  });
}

register(registry);   // self-register on import (behavior-identical to before)
export = register;
