/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var crud = require('../../../lib/crud/');
var match = require('../../../lib/crud/match');

var $where = match.preOperators.$where;


describe('# evaluation operators - development', function() {


  describe('# $where', function() {

    it('# returns values', function() {
      expect( $where( {}, 'null') ).eql(null);
      expect( $where( {}, 'true') ).eql(true);
      expect( $where( {}, '1') ).eql(1);
      expect( $where( {}, '"test"') ).eql('test');
      expect( $where( {}, '{ "property": "test" }') ).eql({ property: 'test' });
    });

    describe('# gets `this` and `obj`', function() {
      var _this = { test: "this" };
      it('# gets this', function() {
        expect($where.call(_this, {}, 'this' )).eql(_this);
      });
      it('# gets obj', function() {
        expect($where.call(_this, {}, 'obj' )).eql(_this);
      });
    });

  });

});
