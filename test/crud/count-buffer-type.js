
// https://docs.mongodb.org/v3.2/reference/method/db.collection.count/


/**
 * Created by alykoshin on 24.08.19.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var mm = require('../../lib/');


describe.only('#count - Buffer type', function() {

  var a = [
    { a:  Buffer.from([1]) },
    { a:  Buffer.from([1,2]), b: 1 },
  ];

  it('#Buffer.from([1]), count=1', function() {
    //db.collection.find( { a: 5, b: 5 } ).count()
    var q = { a: Buffer.from([1]) };
    var r = 1;
    expect(mm.count( a, q )).eql(r);
  });

  it('# Buffer.from([1,2]), count=1', function() {
    //db.collection.find( { a: 5, b: 5 } ).count()
    var q = { a: Buffer.from([1,2]) };
    var r = 1;
    expect(mm.count( a, q )).eql(r);
  });

  it('# Buffer.from([3]), count=0', function() {
    //db.collection.find( { a: 5, b: 5 } ).count()
    var q = { a: Buffer.from([3]) };
    var r = 0;
    expect(mm.count( a, q )).eql(r);
  });

});
