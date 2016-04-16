/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

//var _Query = require('../../../lib/crud/match')._Query;
var _eql = require('../../../lib/crud/match')._eql;


describe.skip('# _Query', function() {

  it('# constructor copies all own properties', function () {
    var o = { test: 'value', array: [ 1, { b: 2 } ] };
    var q = new _Query(o);
    var e = _eql(o, q);
    expect(e).eql(true);
  });

  it('# prepared property', function () {
    var o = { test: 'value' };
    expect(o._prepared).eql(undefined);
    var q = new _Query(o);
    expect(q._prepared).eql(true);
  });

});
