/**
 * Created by alykoshin on 24.03.16.
 */

var mm = require('../');
//var mm = require('micromongo');

var array, query, projection, res;

array = [
  { a: 'abc' },
  { a: 'bcd' },
  { a: 'cde' },
];

query = { a: { $regex: /^bc/ } };

projection = {};


res = mm.find(array, query, projection);
console.log(res);

// [ { a: 'bcd' } ]

