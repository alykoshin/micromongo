/**
 * The query-bound positional `$` update operator: update the FIRST array element
 * matched by the query. Based on the MongoDB "students/grades" doc example.
 *
 * (For every element use `$[]`; for a filtered subset use `$[<id>]` + arrayFilters.)
 */

var mm = require('../');
//var mm = require('micromongo');

// The array field (grades) must appear in the query.
var students = [
  { _id: 1, grades: [ 85, 80, 80 ] },
  { _id: 2, grades: [ 88, 90, 92 ] },
];

mm.updateOne(students, { _id: 1, grades: 80 }, { $set: { 'grades.$': 82 } });
console.log(students[0]);
// { _id: 1, grades: [ 85, 82, 80 ] }   // only the FIRST 80 (index 1) changed

// Into an array of sub-documents, via $elemMatch:
var classes = [ {
  _id: 4,
  grades: [
    { grade: 80, mean: 75, std: 8 },
    { grade: 85, mean: 90, std: 5 },
    { grade: 90, mean: 85, std: 3 },
  ],
} ];

mm.updateOne(classes, { _id: 4, grades: { $elemMatch: { grade: 85 } } },
                      { $set: { 'grades.$.std': 6 } });
console.log(classes[0].grades[1]);
// { grade: 85, mean: 90, std: 6 }
