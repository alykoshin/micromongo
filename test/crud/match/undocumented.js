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


describe('# undocumented side cases', function() {


  describe('# { true: false }', function() {

    const doc =  { prop: 'value' };

    it('# {}', function() {
      expect(match( doc, {} )).eql(true);
    });

    it('# { true: false }', function() {
      expect(match( doc, { true: false } )).eql(false);
    });

    it('# { false: true }', function() {
      expect(match( doc, { false: true } )).eql(false);
    });


  });

});
