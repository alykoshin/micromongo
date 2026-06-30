/**
 * $expr: use an aggregation expression inside a query (compare two fields of the
 * same document). Based on the MongoDB "monthlyBudget" doc example.
 */

var mm = require('../');
//var mm = require('micromongo');

var monthlyBudget = [
  { _id: 1, category: 'food',    budget: 400, spent: 450 },
  { _id: 2, category: 'drinks',  budget: 100, spent: 150 },
  { _id: 3, category: 'clothes', budget: 100, spent: 50  },
  { _id: 4, category: 'misc',    budget: 500, spent: 300 },
  { _id: 5, category: 'travel',  budget: 200, spent: 650 },
];

// documents where spent > budget
var res = mm.find(monthlyBudget, { $expr: { $gt: [ '$spent', '$budget' ] } });
console.log(res.map(function (d) { return d._id; }));
// [ 1, 2, 5 ]

// $expr combines with ordinary query clauses:
res = mm.find(monthlyBudget, {
  category: { $in: [ 'food', 'travel', 'clothes' ] },
  $expr: { $gt: [ '$spent', '$budget' ] },
});
console.log(res.map(function (d) { return d._id; }));
// [ 1, 5 ]
