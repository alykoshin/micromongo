/**
 * registerOperator — micromongo's blessed query-engine extension point
 * (replaces the old direct-mutation of mm._crud._match.postOperators).
 *
 * This is a micromongo-specific concept with no MongoDB equivalent, so it gets a
 * plain unit test (exempt from the -mongodoc.js rule). It exercises: validation,
 * adding a 'post' (field-level) and a 'pre' (whole-document) operator and seeing
 * mm.find() use it, registration via both mm.registerOperator and the
 * lib/crud/match facade, and overriding a built-in.
 */

'use strict';

/* globals describe, afterEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../../dist/');
var match = require('../../../dist/crud/match');


describe('# registerOperator', function () {

  // Operators registered in a test are global; remove them so nothing leaks.
  afterEach(function () {
    delete match.postOperators.$startsWith;
    delete match.preOperators.$docHasKey;
  });

  it('# is exposed on both the mm facade and the match module', function () {
    expect(mm.registerOperator).to.be.a('function');
    expect(match.registerOperator).to.equal(mm.registerOperator);
  });

  it('# validates kind', function () {
    expect(function () { mm.registerOperator('nope', '$x', function () {}); })
      .to.throw(/kind must be/);
  });

  it('# validates the operator name starts with $', function () {
    expect(function () { mm.registerOperator('post', 'noDollar', function () {}); })
      .to.throw(/must be a string starting with/);
  });

  it('# validates fn is a function', function () {
    expect(function () { mm.registerOperator('post', '$x', 123); })
      .to.throw(/must be a function/);
  });

  it('# a custom post (field-level) operator is used by find()', function () {
    mm.registerOperator('post', '$startsWith', function (doc, query) {
      return typeof doc === 'string' && doc.indexOf(query) === 0;
    });
    var data = [ { name: 'apple' }, { name: 'apricot' }, { name: 'banana' } ];
    var res = mm.find(data, { name: { $startsWith: 'ap' } });
    expect(res).eql([ { name: 'apple' }, { name: 'apricot' } ]);
  });

  it('# a custom pre (whole-document) operator is used by find()', function () {
    mm.registerOperator('pre', '$docHasKey', function (doc, query) {
      return Object.prototype.hasOwnProperty.call(doc, query);
    });
    var data = [ { a: 1 }, { b: 2 }, { a: 3, b: 4 } ];
    var res = mm.find(data, { $docHasKey: 'a' });
    expect(res).eql([ { a: 1 }, { a: 3, b: 4 } ]);
  });

  it('# lands in the shared registry table that dispatch reads', function () {
    mm.registerOperator('post', '$startsWith', function () { return true; });
    expect(match.postOperators.$startsWith).to.be.a('function');
  });
});
