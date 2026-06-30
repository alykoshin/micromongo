'use strict';

/**
 * $expr — use an aggregation expression in a query.
 * Ported verbatim from the official MongoDB docs:
 *   https://www.mongodb.com/docs/manual/reference/operator/query/expr/
 * (monthlyBudget example — compare two fields of the same document).
 */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');

describe('# $expr (mongodoc)', function () {

  // db.monthlyBudget.insertMany([...]) — verbatim from the docs.
  function monthlyBudget() {
    return [
      { _id: 1, category: 'food',    budget: 400, spent: 450 },
      { _id: 2, category: 'drinks',  budget: 100, spent: 150 },
      { _id: 3, category: 'clothes', budget: 100, spent: 50  },
      { _id: 4, category: 'misc',    budget: 500, spent: 300 },
      { _id: 5, category: 'travel',  budget: 200, spent: 650 },
    ];
  }

  it('# { $expr: { $gt: ["$spent","$budget"] } } returns docs where spent > budget', function () {
    // db.monthlyBudget.find( { $expr: { $gt: [ "$spent" , "$budget" ] } } )
    var res = mm.find(monthlyBudget(), { $expr: { $gt: [ '$spent', '$budget' ] } });
    expect(res).eql([
      { _id: 1, category: 'food',   budget: 400, spent: 450 },
      { _id: 2, category: 'drinks', budget: 100, spent: 150 },
      { _id: 5, category: 'travel', budget: 200, spent: 650 },
    ]);
  });

  it('# $expr composes with other expression operators ($lt)', function () {
    var res = mm.find(monthlyBudget(), { $expr: { $lt: [ '$spent', '$budget' ] } });
    expect(res.map(function (d) { return d._id; })).eql([ 3, 4 ]); // under budget
  });

  it('# $expr can combine with normal query clauses', function () {
    var res = mm.find(monthlyBudget(), {
      category: { $in: [ 'food', 'travel', 'clothes' ] },
      $expr: { $gt: [ '$spent', '$budget' ] },
    });
    expect(res.map(function (d) { return d._id; })).eql([ 1, 5 ]);
  });

});
