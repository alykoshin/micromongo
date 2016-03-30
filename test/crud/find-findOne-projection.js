/**
 * Created by alykoshin on 26.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, afterEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var crud = require('../../lib/crud/');


describe('#projection', function() {

  var a = [
    { a: 1, b: 5, c: 5 },
    { a: 2, b: 4, c: 5 },
    { a: 3, b: 3, c: 5 },
    { a: 4, b: 2, c: 5 },
    { a: 5, b: 1, c: 5 },
  ];
  var q = {};

  var r0 = [
    {},
    {},
    {},
    {},
    {},
  ];
  var r1 = [
    { a: 1 },
    { a: 2 },
    { a: 3 },
    { a: 4 },
    { a: 5 },
  ];
  var r2 = [
    { b: 5, c: 5 },
    { b: 4, c: 5 },
    { b: 3, c: 5 },
    { b: 2, c: 5 },
    { b: 1, c: 5 },
  ];
  var r3 = a;


  describe('#inclusive', function() {

    describe('#none fields', function() {
      var p1 = { a: 0, b: 0, c: 0};

      it('#find', function() {
        expect( crud.find(a, q, p1)).eql(r0);
      });

      it('#findOne', function() {
        expect( crud.findOne(a, q, p1)).eql( r0[0] );
      });

    });

    describe('#all fields (empty projection)', function() {
      var p1 = {};

      it('#find', function() {
        expect( crud.find(a, q, p1)).eql(r3);
      });

      it('#findOne', function() {
        expect( crud.findOne(a, q, p1)).eql( r3[0] );
      });

    });

    describe('#1 field', function() {

      var p1 = { a: 1 };

      it('#find', function() {
        expect( crud.find(a, q, p1)).eql(r1);
      });

      it('#findOne', function() {
        expect( crud.findOne(a, q, p1)).eql( r1[0] );
      });

    });

    describe('#2 fields', function() {

      var p2 = { b: 1, c: 1 };

      it('#find', function() {
        expect( crud.find(a, q, p2)).eql(r2);
      });

      it('#findOne', function() {
        expect( crud.findOne(a, q, p2)).eql( r2[0] );
      });

    });
  });

  describe('#exclusive', function() {

    var p1 = { b: 0, c: 0 };

    describe('#1 field', function() {

      it('#find', function() {
        expect( crud.find(a, q, p1)).eql(r1);
      });

      it('#findOne', function() {
        expect( crud.findOne(a, q, p1)).eql( r1[0] );
      });

    });

    describe('#2 fields', function() {
      var p2 = { a: 0 };

      it('#find', function() {
        expect( crud.find(a, q, p2)).eql(r2);
      });

      it('#findOne', function() {
        expect( crud.findOne(a, q, p2)).eql( r2[0] );
      });

    });

  });

});


