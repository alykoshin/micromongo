/**
 * $redact aggregation stage — ported from the official MongoDB manual example.
 * Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/redact/
 *
 * $redact evaluates an expression at every document level; it must resolve to
 * $$DESCEND (keep this level, recurse into embedded docs/arrays-of-docs),
 * $$PRUNE (drop this whole level), or $$KEEP (keep this level, no recursion).
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');


describe('# $redact - mongo docs', function () {

  var accounts = [
    {
      _id: 1,
      level: 1,
      acct_id: 'xyz123',
      cc: {
        level: 5,
        type: 'yy',
        num: 0,
        billing_addr: { level: 5, addr1: '123 ABC Street', city: 'Some City' },
        shipping_addr: [
          { level: 3, addr1: '987 XYZ Ave', city: 'Some City' },
          { level: 3, addr1: 'PO Box 0123', city: 'Some City' },
        ],
      },
      status: 'A',
    },
  ];

  it('# prunes the cc subtree (level 5) and keeps the rest', function () {
    var res = mm.aggregate(accounts, [
      { $match: { status: 'A' } },
      { $redact: { $cond: { if: { $eq: [ '$level', 5 ] }, then: '$$PRUNE', else: '$$DESCEND' } } },
    ]);
    expect(res).eql([ { _id: 1, level: 1, acct_id: 'xyz123', status: 'A' } ]);
  });

  it('# $$DESCEND prunes only the matching array elements', function () {
    var a = [ { _id: 1, level: 1, items: [
      { level: 1, v: 'keep' }, { level: 5, v: 'drop' }, { level: 1, v: 'keep2' },
    ] } ];
    var res = mm.aggregate(a, [
      { $redact: { $cond: { if: { $eq: [ '$level', 5 ] }, then: '$$PRUNE', else: '$$DESCEND' } } },
    ]);
    expect(res).eql([ { _id: 1, level: 1, items: [ { level: 1, v: 'keep' }, { level: 1, v: 'keep2' } ] } ]);
  });

});
