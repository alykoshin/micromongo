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

var mm = require('../lib/');


describe('#copyTo', function() {

  var a = [
    { a:  1, b: null },
    { a:  2, b: undefined },
    { a:  3, b: 'string' },
    { a:  4, b: [ 1, 2, 3 ] },
    { a:  5, b: { c: 1 } },
  ];

  it('#copies', function() {
    var r = [];
    var res = mm.copyTo( a, r );
    expect(r).eql(a);
    expect(res).eql(a.length);
  });


});
