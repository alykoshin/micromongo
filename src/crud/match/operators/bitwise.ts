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


registry.registerOperator('post', '$bitsAllSet', function (doc: any /* value */, query: any /* value (operand) */) {
  return h._bitsMatch(doc, query, 'allSet');
});

registry.registerOperator('post', '$bitsAnySet', function (doc: any /* value */, query: any /* value (operand) */) {
  return h._bitsMatch(doc, query, 'anySet');
});

registry.registerOperator('post', '$bitsAllClear', function (doc: any /* value */, query: any /* value (operand) */) {
  return h._bitsMatch(doc, query, 'allClear');
});

registry.registerOperator('post', '$bitsAnyClear', function (doc: any /* value */, query: any /* value (operand) */) {
  return h._bitsMatch(doc, query, 'anyClear');
});
