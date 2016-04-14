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


describe('# evaluation query operators - mongo docs', function() {

  var inventory = [
    { "_id" : 1, "item" : "abc123", "qty" :  0 }, // 0
    { "_id" : 2, "item" : "xyz123", "qty" :  5 }, // 1
    { "_id" : 3, "item" : "ijk123", "qty" : 12 }, // 2
  ];


  describe('# $mod', function() {
    it('# Use $mod to Select Documents', function() {
      var query = { qty: { $mod: [ 4, 0 ] } };
      var res = [
        inventory[0],
        inventory[2],
      ];
      expect(crud.find(inventory, query)).eql(res);
    });

    describe('# Not Enough Elements Error', function() {

      it('# Array with Single Element', function() {
        var query = { qty: { $mod: [ 4 ] } };
        expect(function() {
          crud.find(inventory, query);
        }).throw();
      });

      it('# Empty Array', function() {
        var query = { qty: { $mod: [ ] } };
        expect(function() {
          crud.find(inventory, query);
        }).throw();
      });

       it('# Too Many Elements Error', function() {
        var query = { qty: { $mod: [ 4, 0, 0 ] } };
        expect(function() {
          crud.find(inventory, query);
        }).throw();
      });

    });

  });

});
