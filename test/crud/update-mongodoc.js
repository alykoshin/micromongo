/**
 * Update operators — tests ported VERBATIM from the official MongoDB manual
 * examples (initial document + update spec + expected result), following the
 * repo's `-mongodoc.js` convention.
 *
 * Sources:
 *   $inc:  https://www.mongodb.com/docs/manual/reference/operator/update/inc/
 *   $push: https://www.mongodb.com/docs/manual/reference/operator/update/push/
 *   $pull: https://www.mongodb.com/docs/manual/reference/operator/update/pull/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');


describe('# update operators - mongo docs', function () {

  describe('# $set', function () {

    // Set Top-Level Fields
    it('# Set Top-Level Fields', function () {
      var a = [
        { _id: 1, title: 'The Dark Knight', year: 2008, genres: [ 'Crime', 'Drama', 'Thriller' ] },
      ];
      mm.updateOne(a, { title: 'The Dark Knight' },
        { $set: { label: 'Award Winner', status: 'classic' } });
      expect(a[0]).eql({
        _id: 1, title: 'The Dark Knight', year: 2008,
        genres: [ 'Crime', 'Drama', 'Thriller' ],
        label: 'Award Winner', status: 'classic',
      });
    });

  });

  describe('# $min', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/min/
    it('# updates when the value is less than the current', function () {
      var a = [ { _id: 1, highScore: 800, lowScore: 200 } ];
      mm.updateOne(a, { _id: 1 }, { $min: { lowScore: 150 } });
      expect(a[0]).eql({ _id: 1, highScore: 800, lowScore: 150 });
    });

    it('# no change when the value is not less than the current', function () {
      var a = [ { _id: 1, highScore: 800, lowScore: 150 } ];
      mm.updateOne(a, { _id: 1 }, { $min: { lowScore: 250 } });
      expect(a[0]).eql({ _id: 1, highScore: 800, lowScore: 150 });
    });

  });

  describe('# $max', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/max/
    it('# updates when the value is greater than the current', function () {
      var a = [ { _id: 1, highScore: 800, lowScore: 200 } ];
      mm.updateOne(a, { _id: 1 }, { $max: { highScore: 950 } });
      expect(a[0]).eql({ _id: 1, highScore: 950, lowScore: 200 });
    });

    it('# no change when the value is not greater than the current', function () {
      var a = [ { _id: 1, highScore: 950, lowScore: 200 } ];
      mm.updateOne(a, { _id: 1 }, { $max: { highScore: 870 } });
      expect(a[0]).eql({ _id: 1, highScore: 950, lowScore: 200 });
    });

  });

  describe('# $mul', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/mul/
    // (Decimal128 in the doc replaced with a plain number — micromongo has no BSON types.)
    it('# multiplies an existing field', function () {
      var a = [ { _id: 1, item: 'Hats', quantity: 25 } ];
      mm.updateOne(a, { _id: 1 }, { $mul: { quantity: 2 } });
      expect(a[0]).eql({ _id: 1, item: 'Hats', quantity: 50 });
    });

    it('# sets a non-existing field to 0', function () {
      var a = [ { _id: 2, item: 'Unknown' } ];
      mm.updateOne(a, { _id: 2 }, { $mul: { price: 100 } });
      expect(a[0]).eql({ _id: 2, item: 'Unknown', price: 0 });
    });

  });

  describe('# $rename', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/rename/
    it('# Rename a Top-Level Field', function () {
      var a = [
        { _id: 1,
          alias: [ 'The American Cincinnatus', 'The American Fabius' ],
          mobile: '555-555-5555',
          nmae: { first: 'george', last: 'washington' } },
      ];
      mm.updateOne(a, { _id: 1 }, { $rename: { nmae: 'name' } });
      expect(a[0]).eql({
        _id: 1,
        alias: [ 'The American Cincinnatus', 'The American Fabius' ],
        mobile: '555-555-5555',
        name: { first: 'george', last: 'washington' },
      });
    });

    it('# Rename a Field in an Embedded Document', function () {
      var a = [
        { _id: 1,
          mobile: '555-555-5555',
          name: { first: 'george', last: 'washington' } },
      ];
      mm.updateOne(a, { _id: 1 }, { $rename: { 'name.first': 'name.fname' } });
      expect(a[0]).eql({
        _id: 1,
        mobile: '555-555-5555',
        name: { last: 'washington', fname: 'george' },
      });
    });

  });

  describe('# $inc', function () {

    // Increment Values
    it('# Increment Values (quantity & embedded metrics.orders)', function () {
      var a = [
        { _id: 1, sku: 'abc123', quantity: 10, metrics: { orders: 2, ratings: 3.5 } },
      ];
      mm.updateOne(a, { sku: 'abc123' }, { $inc: { quantity: -2, 'metrics.orders': 1 } });
      expect(a[0]).eql(
        { _id: 1, sku: 'abc123', quantity: 8, metrics: { orders: 3, ratings: 3.5 } }
      );
    });

  });

  describe('# $push', function () {

    // Append a Value to an Array
    it('# Append a Value to an Array', function () {
      var a = [
        { _id: 1, title: 'The Dark Knight', genres: [ 'Action', 'Crime', 'Drama' ] },
      ];
      mm.updateOne(a, { title: 'The Dark Knight' }, { $push: { genres: 'Classic' } });
      expect(a[0].genres).eql([ 'Action', 'Crime', 'Drama', 'Classic' ]);
    });

    // Append Multiple Values with $each
    it('# Append Multiple Values to an Array ($each)', function () {
      var a = [
        { _id: 1, genres: [ 'Action', 'Crime', 'Drama' ] },
      ];
      mm.updateOne(a, { _id: 1 },
        { $push: { genres: { $each: [ 'Modern Classic', 'Award-Winning' ] } } });
      expect(a[0].genres).eql([ 'Action', 'Crime', 'Drama', 'Modern Classic', 'Award-Winning' ]);
    });

    // Use $push with $each, $sort, and $slice
    it('# Use $push with $each, $sort, and $slice', function () {
      var a = [
        { _id: 5, quizzes: [
          { wk: 1, score: 10 },
          { wk: 2, score: 8 },
          { wk: 3, score: 5 },
          { wk: 4, score: 6 },
        ] },
      ];
      mm.updateOne(a, { _id: 5 }, {
        $push: {
          quizzes: {
            $each: [ { wk: 5, score: 8 }, { wk: 6, score: 7 }, { wk: 7, score: 6 } ],
            $sort: { score: -1 },
            $slice: 3,
          },
        },
      });
      expect(a[0].quizzes).eql([
        { wk: 1, score: 10 },
        { wk: 2, score: 8 },
        { wk: 5, score: 8 },
      ]);
    });

  });

  describe('# $addToSet', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/addToSet/
    it('# Add a Value to an Array (not present)', function () {
      var a = [ { _id: 1, item: 'polarizing_filter', tags: [ 'electronics', 'camera' ] } ];
      mm.updateOne(a, { _id: 1 }, { $addToSet: { tags: 'accessories' } });
      expect(a[0].tags).eql([ 'electronics', 'camera', 'accessories' ]);
    });

    it('# Value Already in Array (no-op)', function () {
      var a = [ { _id: 1, item: 'polarizing_filter', tags: [ 'electronics', 'camera' ] } ];
      mm.updateOne(a, { _id: 1 }, { $addToSet: { tags: 'camera' } });
      expect(a[0].tags).eql([ 'electronics', 'camera' ]);
    });

    it('# $addToSet with $each (only new values added)', function () {
      var a = [ { _id: 2, item: 'cable', tags: [ 'electronics', 'supplies' ] } ];
      mm.updateOne(a, { _id: 2 },
        { $addToSet: { tags: { $each: [ 'camera', 'electronics', 'accessories' ] } } });
      expect(a[0].tags).eql([ 'electronics', 'supplies', 'camera', 'accessories' ]);
    });

  });

  describe('# $pop', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/pop/
    it('# Remove the Last Item ($pop: 1)', function () {
      var a = [ { _id: 10, scores: [ 9, 10 ] } ];
      mm.updateOne(a, { _id: 10 }, { $pop: { scores: 1 } });
      expect(a[0]).eql({ _id: 10, scores: [ 9 ] });
    });

    it('# Remove the First Item ($pop: -1)', function () {
      var a = [ { _id: 1, scores: [ 8, 9, 10 ] } ];
      mm.updateOne(a, { _id: 1 }, { $pop: { scores: -1 } });
      expect(a[0]).eql({ _id: 1, scores: [ 9, 10 ] });
    });

  });

  describe('# $pull', function () {

    // Remove All Items That Equal a Specified Value ($in + value)
    it('# Remove All Items That Equal a Specified Value', function () {
      var a = [
        {
          _id: 1,
          fruits: [ 'apples', 'pears', 'oranges', 'grapes', 'bananas' ],
          vegetables: [ 'carrots', 'celery', 'squash', 'carrots' ],
        },
      ];
      mm.updateOne(a, { _id: 1 },
        { $pull: { fruits: { $in: [ 'apples', 'oranges' ] }, vegetables: 'carrots' } });
      expect(a[0]).eql({
        _id: 1,
        fruits: [ 'pears', 'grapes', 'bananas' ],
        vegetables: [ 'celery', 'squash' ],
      });
    });

    // Remove Items That Match a Condition
    it('# Remove All Items That Match a Specified $pull Condition', function () {
      var a = [ { _id: 1, votes: [ 3, 5, 6, 7, 7, 8 ] } ];
      mm.updateOne(a, { _id: 1 }, { $pull: { votes: { $gte: 6 } } });
      expect(a[0].votes).eql([ 3, 5 ]);
    });

    // Remove Items from an Array of Documents (multiple field conditions)
    it('# Remove Items from an Array of Documents', function () {
      var a = [
        { _id: 1, results: [ { item: 'A', score: 5 }, { item: 'B', score: 8 } ] },
      ];
      mm.updateOne(a, { _id: 1 }, { $pull: { results: { score: 8, item: 'B' } } });
      expect(a[0].results).eql([ { item: 'A', score: 5 } ]);
    });

  });

  describe('# $pullAll', function () {

    // https://www.mongodb.com/docs/manual/reference/operator/update/pullAll/
    it('# removes all instances of the listed values', function () {
      var a = [ { _id: 1, scores: [ 0, 2, 5, 5, 1, 0 ] } ];
      mm.updateOne(a, { _id: 1 }, { $pullAll: { scores: [ 0, 5 ] } });
      expect(a[0]).eql({ _id: 1, scores: [ 2, 1 ] });
    });

  });

});
