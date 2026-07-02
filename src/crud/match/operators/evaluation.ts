/**
 * Evaluation query postOperators: $mod, $regex, $options.
 *
 * ($where is a preOperator — see operators/logical.js. $comment is a preprocess
 * operator — see operators/preprocess.js. $text is also a preOperator.)
 */

'use strict';

var assert = require('../../../assert');

var registry = require('../registry');


// See operators/bitwise.ts for the register(reg) + self-call + `export =` convention.
function register(reg: any): void {
  reg.registerOperator('post', '$mod', function (doc: any /* value */, query: any /* values (operand) */) {
    assert(Array.isArray(query) && query.length === 2, 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $in must be array with length = 2');
    var divisor = query[0];
    var remainder = query[1];
    return doc % divisor === remainder;
  });

  reg.registerOperator('post', '$regex', function (doc: any /* value */, query: any /* value (regex operand) */, options: any /* value ($options flags) */) {
    assert(query instanceof RegExp, 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $regex must be regex');

    if (options) { query = new RegExp(query.source, options); }

    var res = typeof doc === 'string' && query.test(doc);
    return res;
  });

  reg.registerOperator('post', '$options', function (doc: any /* value */, query: any /* value */, options: any /* value */) {
    // do nothing as this is not operator
    return true;  // as usually it is inside implicit $and
  });
}

register(registry);
export = register;
