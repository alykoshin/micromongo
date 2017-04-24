/**
 *
 * This file is an example how to extend the functionality of micromongo in runtime
 * It shows how to add new function $sortAlphaNumeric to aggregation framework
 * or replace existing $sort function.
 *
 */

"use strict";


const _ = require('lodash');
const mm = require('../');
//const mm = require('micromongo');

const log = [
  { num: 2,  str: '2' },
  { num: 1,  str: '1' },
  { num: 10, str: '10' },
];

var sorted = mm.aggregate(log, [{ $sort: { num: 1 } }]);
console.log('Sorting by numeric field:', JSON.stringify(sorted));

var sorted = mm.aggregate(log, [{ $sort: { str: 1 } }]);
console.log('Sorting by string field:', JSON.stringify(sorted));

console.log('Extending _aggregateStages with new $sortAlphaNumeric function...');

mm.aggregate._aggregateStageOps.$sortAlphaNumeric = function(array, params, options) {
  return array.sort(function(doc1,doc2) {
    for (var p in params) { if (params.hasOwnProperty(p)) {
      var dir = params[p];
      if ([-1,1 ].indexOf(dir) < 0 ) { throw new Error('Sort direction may be -1 or 1'); }
      var v1 = _.get(doc1, p);
      var v2 = _.get(doc2, p);
      if (!isNaN(parseFloat(v1)) && isFinite(v1) && !isNaN(parseFloat(v2)) && isFinite(v2)) {
        v1 = Number(v1);
        v2 = Number(v2);
      }

      var res = (v1 < v2) ? -1 : ((v1 > v2) ? 1 : 0);
      res = res * dir;

      // if current fields are different, return direction
      // otherwise, we'll go to next parameter
      if (res !== 0) { return res; }
    }}
    // if we went out from cycle, that means, both docs are the same
    return 0;
  });
};


sorted = mm.aggregate(log, [{ $sortAlphaNumeric: { str: 1 } }]);
console.log('Sorting by string field:', JSON.stringify(sorted));


console.log('Overriding default $sort in _aggregateStages with $sortAlphaNumeric function...');

mm.aggregate._aggregateStageOps.$sort = mm.aggregate._aggregateStageOps.$sortAlphaNumeric;

sorted = mm.aggregate(log, [{ $sort: { str: 1 } }]);
console.log('Sorting by string field:', JSON.stringify(sorted));


