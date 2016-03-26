/**
 * Created by alykoshin on 24.03.16.
 */

var mm = require('../');
//var mm = require('micromongo');

var array, query, res;

array = [
  { a: 1 },
  { a: 2 },
  { a: 3 },
];

query = { a: { $gte: 2 } };

res = mm.count(array, query);
console.log(res);

// 2

query = {};

res = mm.count(array, query);
console.log(res);

// 3
