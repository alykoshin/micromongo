/**
 * Created by alykoshin on 24.03.16.
 */

var mm = require('../');
//var mm = require('micromongo');

var collection, query, res;

collection = [
  { a: 1 },
  { a: 2 },
  { a: 3 },
];

query = { a: { $gte: 2 } };

res = mm.count(collection, query);
console.log(res);

// 2

query = {};

res = mm.count(collection, query);
console.log(res);

// 3
