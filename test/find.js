/**
 * Created by alykoshin on 26.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, afterEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var mm = require('../lib/');


describe('#find & findOne', function() {
  describe('#projection', function() {


    var c = [
      { a: 1, b: 5, c: 5 },
      { a: 2, b: 4, c: 5 },
      { a: 3, b: 3, c: 5 },
      { a: 4, b: 2, c: 5 },
      { a: 5, b: 1, c: 5 },
    ];
    var q = {};

    describe('#inclusive', function() {
      var r1 = [
        { a: 1 },
        { a: 2 },
        { a: 3 },
        { a: 4 },
        { a: 5 },
      ];
      var p1 = { a: 1 };

      it('#inclusive find', function() {
        expect( mm.find(c, q, p1)).eql(r1);
      });

      it('#inclusive findOne', function() {
        expect( mm.findOne(c, q, p1)).eql( r1[0] );
      });

    });
  });


});
