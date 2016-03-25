/**
 * Created by alykoshin on 24.03.16.
 */

var mm = require('../');
//var mm = require('micromongo');

var data = [
  { qty: 10, price: 10 },
  { qty: 10, price:  0 },
  { qty: 20, price: 10 },
  { qty: 20, price:  0 },
  { qty: 30, price: 10 },
  { qty: 30, price:  0 },
];
var query = { $or: [ { quantity: { $eq: 20 } }, { price: { $lt: 10 } } ] };
var projection = { qty: 1 };

var res = mm.find(data, query, projection);

console.log(res);

// [ { qty: 10 }, { qty: 20 }, { qty: 30 } ]
