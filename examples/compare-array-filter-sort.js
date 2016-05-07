/**
 * Created by alykoshin on 07.05.16.
 */
"use strict";

var mm = require('../');
var _ = require('lodash');

var array = [
  { orderId: 111, value: 100 },
  { orderId: 222, value: 100 },
  { orderId: 222, value: 200 },
  { orderId: 333, value: 300 },
];


var resFind1 = mm.find(array, { $or: [ { orderId: 222 }, { value: { $gt: 100 }} ] });
console.log('mm.find():', resFind1);

var resFind2 = array.filter(function(value) {
  return value.orderId === 222 || value.value > 100;
});
console.log('array.filter():', resFind2);


var resSort1 = mm.aggregate(array, [
  { $sort: { orderId: -1} }
]);
console.log('mm.aggregate([{$sort}]):', resSort1);

var resSort2 = array.sort(function(a,b) {
  return a.orderId < b.orderId;
});
console.log('array.sort():', resSort2);
