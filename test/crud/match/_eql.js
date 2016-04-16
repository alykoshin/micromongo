/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var _eql = require('../../../lib/crud/match')._eql;


describe('# _eql', function() {

  it('# empty', function () {
    expect(_eql({}, {})).eql(true);
  });

  it('# scalar', function () {
    expect(_eql(null,      null     )).eql(true);
    expect(_eql(undefined, undefined)).eql(true);
    expect(_eql(1,         1        )).eql(true);
    expect(_eql('a',       'a'      )).eql(true);
    expect(_eql(true,      true     )).eql(true);
  });

  it('# one level', function () {
    expect(_eql({ a: 1, b: 2 }, { a: 1, b: 2 })).eql(true);
    expect(_eql({ a: 1, b: 2 }, { a: 1, b: 3 })).eql(false);
    expect(_eql({ a: 1       }, { a: 1, b: 2 })).eql(false);
    expect(_eql({ a: 1, b: 2 }, { a: 1       })).eql(false);
  });

  it('# one level null & undefined', function () {
    expect(_eql({ a: null      }, { a: null      })).eql(true);
    expect(_eql({ a: null      }, { a: {}        })).eql(false);
    expect(_eql({ a: undefined }, { a: undefined })).eql(true);
    expect(_eql({ a: undefined }, {              })).eql(true);
    expect(_eql({ a: undefined }, { a: 1         })).eql(false);
    expect(_eql({ a: undefined }, { a: {}        })).eql(false);
  });

  it('# two level', function () {
    expect(_eql({ a: 1, b: { c: 3 } }, { a: 1, b: { c: 3 } })).eql(true);
    expect(_eql({ a: 1, b: { c: 3 } }, { a: 1, b: 2        })).eql(false);
    expect(_eql({ a: 1, b: 2        }, { a: 1, b: { c: 3 } })).eql(false);
    expect(_eql({ a: 1, b: { c: 3 } }, { a: 1, b: { c: 4 } })).eql(false);
    expect(_eql({ a: 1, b: { c: 3 } }, { a: 1, b: { d: 3 } })).eql(false);
  });

  it('# one level arrays', function () {
    expect(_eql([],  [])).eql(true);

    expect(_eql([1      ], [1     ])).eql(true);
    expect(_eql([1      ], [2     ])).eql(false);
    expect(_eql([1,2    ], [1,2   ])).eql(true);
    expect(_eql([1,2    ], [1,3   ])).eql(false);
  });

  it('# two level arrays', function () {
    expect(_eql([1,[1  ]], [1,[1  ]])).eql(true);
    expect(_eql([1,[1,2]], [1,[1,2]])).eql(true);
    expect(_eql([1,[1,2]], [1,[1,3]])).eql(false);
  });

  it('# one level arrays, sameOrder', function () {
    expect(_eql([1,2    ], [1,2   ], { sameOrder: false })).eql(true);
    expect(_eql([1,2    ], [2,1   ], { sameOrder: false })).eql(true);
    expect(_eql([1,2    ], [1,2   ], { sameOrder: true  })).eql(true);
    expect(_eql([1,2    ], [2,1   ], { sameOrder: true  })).eql(false);
  });

});
