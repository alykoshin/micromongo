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


describe('# $comment-mongodoc', function() {
  var _console_log = console.log;

  beforeEach(function() {
  });

  afterEach(function() {
    console.log = _console_log;
  });

  var overrideLog = function(expectedMsg, cb) {
    console.log = function(s) {
      _console_log(s);
      if (s === expectedMsg) { cb(); }
    };
  };

  it('# passes query to console.log', function(done) {
    var msg = 'Find even values.';
    var query = {
      x: { $mod: [ 2, 0 ] },
      $comment: msg
    };
    var records = [ { x: 0 }, { x: 1 }, { x: 2 } ];

    overrideLog(msg, done);
    crud.find(records, query);
  });


});
