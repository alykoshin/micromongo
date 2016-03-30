/**
 * Created by alykoshin on 25.03.16.
 */

// https://docs.mongodb.org/v3.2/reference/method/db.collection.count/


/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var mm = require('../../lib/');


describe('#count - mongodb docs', function() {

  var a = [
    { a:  5, b:  5, c: 5, ord_dt: new Date('01/01/2012') },
    { a:  5, b:  5, c: 0, ord_dt: new Date('02/01/2012') },
    { a:  5, b: 10, c: 5, ord_dt: new Date('31/12/2011') },
    { a:  5, b: 15, c: 5 },
    { a:  5, b:  1, c: 5 },
    { a: 10, b:  3, c: 5 },
  ];

  it('#{ a: 5, b: 5 }', function() {
    //db.collection.find( { a: 5, b: 5 } ).count()
    var q = { a: 5, b: 5 };
    var r = 2;
    expect(mm.count( a, q )).eql(r);
  });

  it('#{ a: { $gt: 5 } }', function() {
    //db.collection.find( { a: { $gt: 5 } } ).count()
    var q =  { a: { $gt: 5 } };
    var r = 1;
    expect(mm.count( a, q )).eql(r);
  });

  it('#{ a: 5, b: { $gt: 10 } }', function() {
    //db.collection.find( { a: 5, b: { $gt: 10 } } ).count()
    var q =  { a: 5, b: { $gt: 10 } };
    var r = 1;
    expect(mm.count( a, q )).eql(r);
  });

  it('#{ a: 5, b: { $in: [ 1, 2, 3 ] } }', function() {
    //db.collection.find( { a: 5, b: { $in: [ 1, 2, 3 ] } } ).count()
    var q = { a: 5, b: { $in: [ 1, 2, 3 ] } };
    var r = 1;
    expect(mm.count( a, q )).eql(r);
  });

  it('#{ a: { $gt: 5 }, b: 5 }', function() {
    //db.collection.find( { a: { $gt: 5 }, b: 5 } ).count()
    var q =  { a: { $gt: 5 }, b: 5 };
    var r = 0;
    expect(mm.count( a, q )).eql(r);
  });

  it('#{ a: 5, b: 5, c: 5 }', function() {
    //db.collection.find( { a: 5, b: 5, c: 5 } ).count()
    var q = { a: 5, b: 5, c: 5 };
    var r = 1;
    expect(mm.count( a, q )).eql(r);
  });

  describe('# Count all Documents in a Collection', function() {
    it('# empty object', function() {
      //db.orders.count()
      var q = {};
      var r = 6;
      expect(mm.count( a, q )).eql(r);
    });

    it('# undefined query', function() {
      //db.orders.count()
      var q = undefined;
      var r = 6;
      expect(mm.count( a, q )).eql(r);
    });

    it('# that Match a Query', function() {
      //db.orders.count( { ord_dt: { $gt: new Date('01/01/2012') } } )
      var q = { ord_dt: { $gt: new Date('01/01/2012') } };
      var r = 1;
      expect(mm.count( a, q )).eql(r);
    });
  });


});
