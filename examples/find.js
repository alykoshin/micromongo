/**
 * Created by alykoshin on 24.03.16.
 */

var mm = require('../');
//var mm = require('micromongo');

var array, query, projection, res;

array = [
  { qty: 10, price: 10 },
  { qty: 10, price:  0 },
  { qty: 20, price: 10 },
  { qty: 20, price:  0 },
  { qty: 30, price: 10 },
  { qty: 30, price:  0 },
];

query = { $or: [ { quantity: { $eq: 20 } }, { price: { $lt: 10 } } ] };

projection = { qty: 1 };


res = mm.find(array, query, projection);
console.log(res);

// [ { qty: 10 }, { qty: 20 }, { qty: 30 } ]


res = mm.findOne(array, query, projection);
console.log(res);

// { qty: 10 }

