/**
 * Update operators: updateOne / updateMany / replaceOne, and upsert.
 */

var mm = require('../');
//var mm = require('micromongo');

var array, res;

array = [
  { _id: 1, status: 'A', qty: 10 },
  { _id: 2, status: 'A', qty: 20 },
  { _id: 3, status: 'B', qty: 30 },
];

// updateOne — first match only
res = mm.updateOne(array, { status: 'A' }, { $set: { status: 'C' } });
console.log(res);
// { acknowledged: true, matchedCount: 1, modifiedCount: 1 }

// updateMany — all matches
res = mm.updateMany(array, { status: 'A' }, { $inc: { qty: 5 } });
console.log(res);
// { acknowledged: true, matchedCount: 1, modifiedCount: 1 }   (one 'A' left after the updateOne above)

// replaceOne — whole-document replacement (no operators)
res = mm.replaceOne(array, { _id: 3 }, { _id: 3, status: 'Z', qty: 0 });
console.log(res);
// { acknowledged: true, matchedCount: 1, modifiedCount: 1 }

// upsert — no match inserts a doc built from the query + update
res = mm.updateOne(array, { _id: 7 }, { $set: { status: 'NEW' } }, { upsert: true });
console.log(res);
// { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: 7, upsertedCount: 1 }
