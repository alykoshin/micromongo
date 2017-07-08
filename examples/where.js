/**
 * Created by alykoshin on 24.03.16.
 */

var mm = require('../');
//var mm = require('micromongo');

var array, query, projection, res;

array = [
  { a: 1 },
  { a: 2 },
  { a: 3 },
];

projection = {};


query = { $where: 'true' };

console.log('query:', query);
res = mm.find(array, query, projection);
console.log(res);


query = { $where: 'false' };

console.log('query:', query);
res = mm.find(array, query, projection);
console.log(res);


query = { true: false };

console.log('query:', query);
res = mm.find(array, query, projection);
console.log(res);
