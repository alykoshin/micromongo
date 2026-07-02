/**
 * bulkWrite: a batch of heterogeneous writes in one call.
 * Based on the MongoDB "pizzas" doc example.
 */

var mm = require('../');
//var mm = require('micromongo');

var pizzas = [
  { _id: 0, type: 'pepperoni', size: 'small',  price: 4 },
  { _id: 1, type: 'cheese',    size: 'medium', price: 7 },
  { _id: 2, type: 'vegan',     size: 'large',  price: 8 },
];

var res = mm.bulkWrite(pizzas, [
  { insertOne:  { document: { _id: 3, type: 'beef', size: 'medium', price: 6 } } },
  { updateOne:  { filter: { type: 'cheese' }, update: { $set: { price: 8 } } } },
  { deleteOne:  { filter: { type: 'pepperoni' } } },
  { replaceOne: { filter: { type: 'vegan' }, replacement: { type: 'tofu', size: 'small', price: 4 } } },
]);

console.log(res);
// {
//   acknowledged: true,
//   insertedCount: 1, matchedCount: 2, modifiedCount: 2, deletedCount: 1, upsertedCount: 0,
//   insertedIds: { '0': 3 }, upsertedIds: {}
// }   (matched 2 = the cheese updateOne + the vegan replaceOne)

console.log(pizzas.map(function (p) { return p.type; }).sort());
// [ 'beef', 'cheese', 'tofu' ]

// ordered:false — every op is attempted; errors are collected, not thrown.
var arr = [ { _id: 1, type: 'cheese' } ];
var res2 = mm.bulkWrite(arr, [
  { insertOne: { document: { _id: 5, type: 'beef' } } },
  { updateOne: { filter: { type: 'cheese' }, update: { notAnOperator: 1 } } }, // errors
  { insertOne: { document: { _id: 6, type: 'sausage' } } },                    // still runs
], { ordered: false });

console.log(res2.insertedCount, res2.writeErrors && res2.writeErrors.length);
// 2 1
