/**
 * Specialized projection operators — $slice, $elemMatch, and positional $.
 * Tests ported verbatim from the official MongoDB manual examples.
 *
 * Sources:
 *   $slice:     https://www.mongodb.com/docs/manual/reference/operator/projection/slice/
 *   $elemMatch: https://www.mongodb.com/docs/manual/reference/operator/projection/elemMatch/
 *   $ (positional): https://www.mongodb.com/docs/manual/reference/operator/projection/positional/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var crud = require('../../dist/crud/');


describe('# projection operators - mongo docs', function () {

  describe('# $slice', function () {

    var post = {
      _id: 2,
      title: 'Coffee please.',
      comments: [
        { comment: '0. fooey' },
        { comment: '1. tea please' },
        { comment: '2. iced coffee' },
        { comment: '3. cappuccino' },
        { comment: '4. whatever' },
      ],
    };

    it('# $slice: 3 returns the first 3 array elements (other fields kept)', function () {
      expect(crud.find([ post ], {}, { comments: { $slice: 3 } })).eql([
        {
          _id: 2,
          title: 'Coffee please.',
          comments: [
            { comment: '0. fooey' },
            { comment: '1. tea please' },
            { comment: '2. iced coffee' },
          ],
        },
      ]);
    });

    it('# $slice: [1, 3] skips 1 then returns 3', function () {
      var res = crud.find([ post ], {}, { comments: { $slice: [ 1, 3 ] } });
      expect(res[0].comments).eql([
        { comment: '1. tea please' },
        { comment: '2. iced coffee' },
        { comment: '3. cappuccino' },
      ]);
    });

  });

  describe('# $elemMatch', function () {

    var schools = [
      { _id: 1, zipcode: '63109', students: [
        { name: 'john', school: 102, age: 10 },
        { name: 'jess', school: 102, age: 11 },
        { name: 'jeff', school: 108, age: 15 },
      ] },
      { _id: 3, zipcode: '63109', students: [
        { name: 'ajax', school: 100, age: 7 },
        { name: 'achilles', school: 100, age: 8 },
      ] },
      { _id: 4, zipcode: '63109', students: [
        { name: 'barney', school: 102, age: 7 },
        { name: 'ruth', school: 102, age: 16 },
      ] },
    ];

    it('# returns only the first matching array element; omits field if none match', function () {
      var res = crud.find(schools, { zipcode: '63109' },
        { students: { $elemMatch: { school: 102 } } });
      expect(res).eql([
        { _id: 1, students: [ { name: 'john', school: 102, age: 10 } ] },
        { _id: 3 },
        { _id: 4, students: [ { name: 'barney', school: 102, age: 7 } ] },
      ]);
    });

  });

  describe('# $ (positional)', function () {

    var students = [
      { _id: 1, semester: 1, grades: [ 70, 87, 90 ] },
      { _id: 2, semester: 1, grades: [ 90, 88, 92 ] },
      { _id: 3, semester: 1, grades: [ 85, 100, 90 ] },
      { _id: 4, semester: 2, grades: [ 79, 85, 80 ] },
      { _id: 5, semester: 2, grades: [ 88, 88, 92 ] },
      { _id: 6, semester: 2, grades: [ 95, 90, 96 ] },
    ];

    it('# projects the first array element matching the query condition', function () {
      var res = crud.find(students, { semester: 1, grades: { $gte: 85 } }, { 'grades.$': 1 });
      expect(res).eql([
        { _id: 1, grades: [ 87 ] },
        { _id: 2, grades: [ 90 ] },
        { _id: 3, grades: [ 85 ] },
      ]);
    });

  });

});
