'use strict';

/**
 * The query-bound positional `$` update operator — updates the FIRST array
 * element matched by the query. Ported verbatim from the official MongoDB docs:
 *   https://www.mongodb.com/docs/manual/reference/operator/update/positional/
 *
 * (Distinct from `$[]` (all elements) and `$[<id>]` (arrayFilters) — those are
 * covered in update-positional-mongodoc.js.)
 */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');

describe('# positional `$` update (mongodoc)', function () {

  function students() {
    return [
      { _id: 1, grades: [ 85, 80, 80 ] },
      { _id: 2, grades: [ 88, 90, 92 ] },
      { _id: 3, grades: [ 85, 100, 90 ] },
    ];
  }

  it('# updateOne({_id:1, grades:80}, {$set:{"grades.$":82}}) updates the first matching element', function () {
    var arr = students();
    var res = mm.updateOne(arr, { _id: 1, grades: 80 }, { $set: { 'grades.$': 82 } });
    expect(res).eql({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
    // first 80 (index 1) → 82; the second 80 (index 2) is untouched.
    expect(arr[0]).eql({ _id: 1, grades: [ 85, 82, 80 ] });
  });

  it('# $ uses the FIRST matched element only (not all matches)', function () {
    var arr = [ { _id: 1, grades: [ 80, 80, 80 ] } ];
    mm.updateOne(arr, { grades: 80 }, { $inc: { 'grades.$': 1 } });
    expect(arr[0].grades).eql([ 81, 80, 80 ]); // only index 0
  });

  it('# $ works with a range condition on the array field (first element matching $gte)', function () {
    // Mongo doc variant: db.students.updateMany({grades:{$gte:85}}, {$set:{"grades.$":100}})
    var arr = students();
    var res = mm.updateMany(arr, { grades: { $gte: 85 } }, { $set: { 'grades.$': 100 } });
    expect(res.matchedCount).eql(3);
    // each doc: first element with grade >= 85 set to 100
    expect(arr[0].grades).eql([ 100, 80, 80 ]);  // 85 at idx 0
    expect(arr[1].grades).eql([ 100, 90, 92 ]);  // 88 at idx 0
    expect(arr[2].grades).eql([ 100, 100, 90 ]); // 85 at idx 0
  });

  it('# $.field — positional into an array of subdocuments (via $elemMatch)', function () {
    // Mongo's docs use the dotted form { "grades.grade": 85 }; micromongo's matcher
    // doesn't yet traverse dotted paths into array elements (a separate matcher gap),
    // so we use the equivalent, supported $elemMatch query form to bind the positional $.
    // db.students.updateOne({_id:4, grades:{$elemMatch:{grade:85}}}, {$set:{"grades.$.std":6}})
    var arr = [ {
      _id: 4,
      grades: [
        { grade: 80, mean: 75, std: 8 },
        { grade: 85, mean: 90, std: 5 },
        { grade: 90, mean: 85, std: 3 },
      ],
    } ];
    mm.updateOne(arr, { _id: 4, grades: { $elemMatch: { grade: 85 } } }, { $set: { 'grades.$.std': 6 } });
    expect(arr[0].grades[1]).eql({ grade: 85, mean: 90, std: 6 });
    expect(arr[0].grades[0].std).eql(8); // others untouched
  });

  it('# throws if the array field is not in the query (Mongo requires it)', function () {
    var arr = students();
    expect(function () {
      mm.updateOne(arr, { _id: 1 }, { $set: { 'grades.$': 99 } }); // no grades condition
    }).to.throw(/positional operator/);
  });

});
