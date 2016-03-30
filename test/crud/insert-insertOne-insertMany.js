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

var crud = require('../../lib/crud/');


describe('#insert-insertOne-insertMany', function() {
  var a;

  beforeEach(function() {
    a = [
      { a: 1 }
    ];
  });

  describe('#insert', function() {

    it('#insert single doc', function() {
      var i = { a: 2 };
      var r = a.slice(); r.push(i);

      var res = crud.insert(a, i);

      expect(a).eql(r);
      expect(res).eql({ nInserted: 1 });
    });

    it('#insert array', function() {
      var i = [
        { a: 2 },
        { a: 3 },
      ];
      var r = a.concat(i);

      var res = crud.insert(a, i);

      expect(a).eql(r);
      expect(res).eql({ nInserted: i.length });
    });

  });

  it('#insertOne', function() {
    var i = { a: 2 };
    var r = a.slice(); r.push(i);

    var res = crud.insert(a, i);

    expect(a).eql(r);
    expect(res).eql({ nInserted: 1 });
  });

  it('#insertMany', function() {
    var i = [
      { a: 2 },
      { a: 3 },
    ];
    var r = a.concat(i);

    var res = crud.insert(a, i);

    expect(a).eql(r);
    expect(res).eql({ nInserted: i.length });
  });


});
