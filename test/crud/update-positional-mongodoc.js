/**
 * Positional array update operators ($[] and $[<identifier>]) + $bit — ported
 * VERBATIM from the official MongoDB manual.
 *
 * Sources:
 *   $[]            https://www.mongodb.com/docs/manual/reference/operator/update/positional-all/
 *   $[<identifier>] https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered/
 *   $bit           https://www.mongodb.com/docs/manual/reference/operator/update/bit/
 *
 * Each block uses the manual's literal initial documents, exact update spec /
 * arrayFilters, and documented resulting documents.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');


describe('# $[] all-positional - mongo docs', function () {

  it('# $inc every element of an array', function () {
    // https://www.mongodb.com/docs/manual/reference/operator/update/positional-all/
    var students = [
      { _id: 1, grades: [ 85, 82, 80 ] },
      { _id: 2, grades: [ 88, 90, 92 ] },
      { _id: 3, grades: [ 85, 100, 90 ] },
    ];
    mm.updateMany(students, {}, { $inc: { 'grades.$[]': 10 } });
    expect(students).eql([
      { _id: 1, grades: [ 95, 92, 90 ] },
      { _id: 2, grades: [ 98, 100, 102 ] },
      { _id: 3, grades: [ 95, 110, 100 ] },
    ]);
  });

  it('# $inc a field of every embedded document in an array (dot notation)', function () {
    // https://www.mongodb.com/docs/manual/reference/operator/update/positional-all/
    var students2 = [
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 8 },
        { grade: 85, mean: 90, std: 6 },
        { grade: 85, mean: 85, std: 8 },
      ] },
    ];
    mm.updateMany(students2, {}, { $inc: { 'grades.$[].std': -2 } });
    expect(students2).eql([
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 6 },
        { grade: 85, mean: 90, std: 4 },
        { grade: 85, mean: 85, std: 6 },
      ] },
    ]);
  });
});


describe('# $[<identifier>] filtered-positional - mongo docs', function () {

  it('# update array elements matching arrayFilters', function () {
    // https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered/
    var students = [
      { _id: 1, grades: [ 95, 92, 90 ] },
      { _id: 2, grades: [ 98, 100, 102 ] },
      { _id: 3, grades: [ 95, 110, 100 ] },
    ];
    mm.updateMany(students, {},
      { $set: { 'grades.$[element]': 100 } },
      { arrayFilters: [ { element: { $gte: 100 } } ] });
    expect(students).eql([
      { _id: 1, grades: [ 95, 92, 90 ] },
      { _id: 2, grades: [ 98, 100, 100 ] },
      { _id: 3, grades: [ 95, 100, 100 ] },
    ]);
  });

  it('# update a field of embedded docs matching arrayFilters (dotted identifier)', function () {
    // https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered/
    var students2 = [
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 6 },
        { grade: 85, mean: 90, std: 4 },
        { grade: 85, mean: 85, std: 6 },
      ] },
      { _id: 2, grades: [
        { grade: 90, mean: 75, std: 6 },
        { grade: 87, mean: 90, std: 3 },
        { grade: 85, mean: 85, std: 4 },
      ] },
    ];
    mm.updateMany(students2, {},
      { $set: { 'grades.$[elem].mean': 100 } },
      { arrayFilters: [ { 'elem.grade': { $gte: 85 } } ] });
    expect(students2).eql([
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 6 },
        { grade: 85, mean: 100, std: 4 },
        { grade: 85, mean: 100, std: 6 },
      ] },
      { _id: 2, grades: [
        { grade: 90, mean: 100, std: 6 },
        { grade: 87, mean: 100, std: 3 },
        { grade: 85, mean: 100, std: 4 },
      ] },
    ]);
  });
});


describe('# $bit update operator - mongo docs', function () {

  it('# bitwise AND (13 & 10 = 8)', function () {
    // https://www.mongodb.com/docs/manual/reference/operator/update/bit/
    var switches = [ { _id: 1, expdata: 13 } ];
    mm.updateOne(switches, { _id: 1 }, { $bit: { expdata: { and: 10 } } });
    expect(switches).eql([ { _id: 1, expdata: 8 } ]);
  });

  it('# bitwise OR (3 | 5 = 7)', function () {
    var switches = [ { _id: 2, expdata: 3 } ];
    mm.updateOne(switches, { _id: 2 }, { $bit: { expdata: { or: 5 } } });
    expect(switches).eql([ { _id: 2, expdata: 7 } ]);
  });

  it('# bitwise XOR (1 ^ 5 = 4)', function () {
    var switches = [ { _id: 3, expdata: 1 } ];
    mm.updateOne(switches, { _id: 3 }, { $bit: { expdata: { xor: 5 } } });
    expect(switches).eql([ { _id: 3, expdata: 4 } ]);
  });
});
