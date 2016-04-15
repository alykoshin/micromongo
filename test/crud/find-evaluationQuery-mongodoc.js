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

  describe('# $mod', function() {

    var inventory = [
      { "_id" : 1, "item" : "abc123", "qty" :  0 }, // 0
      { "_id" : 2, "item" : "xyz123", "qty" :  5 }, // 1
      { "_id" : 3, "item" : "ijk123", "qty" : 12 }, // 2
    ];

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

  describe('# $mod', function() {
    var products = [
      { "_id" : 100, "sku" : "abc123", "description" : "Single line description."    }, // 0
      { "_id" : 101, "sku" : "abc789", "description" : "First line\nSecond line"     }, // 1
      { "_id" : 102, "sku" : "xyz456", "description" : "Many spaces before     line" }, // 2
      { "_id" : 103, "sku" : "xyz789", "description" : "Multiple\nline description"  }, // 3
    ];


    it('# Perform Case-Insensitive Regular Expression Match', function() {
      var query = { sku: { $regex: /^ABC/i } };
      var res = [
        products[0],
        products[1],
      ];
      expect(crud.find(products, query)).eql(res);
    });

    describe('# Multiline Match for Lines Starting with Specified Pattern', function() {
      it('# m option', function() {
        var query = { description: { $regex: /^S/, $options: 'm' } };
        var res = [
          products[0],
          products[1],
        ];
        expect(crud.find(products, query)).eql(res);
      });

      it('# without the m option', function() {
        var query = { description: { $regex: /^S/ } };
        var res = [
          products[0],
        ];
        expect(crud.find(products, query)).eql(res);
      });

      it('# pattern does not contain an anchor', function() {
        var query = { description: { $regex: /S/ } };
        var res = [
          products[0],
          products[1],
        ];
        expect(crud.find(products, query)).eql(res);
      });
    });

    describe('# Use the . Dot Character to Match New Line', function() {
      it.skip('# s option', function() {
        var query = { description: { $regex: /m.*line/, $options: 'si' } };
        var res = [
          products[0],
          products[3],
        ];
        expect(crud.find(products, query)).eql(res);
      });

      it('# without the s option', function() {
        var query = { description: { $regex: /m.*line/, $options: 'i' } };
        var res = [
          products[2],
        ];
        expect(crud.find(products, query)).eql(res);
      });
    });


    it.skip('# Ignore White Spaces in Pattern', function() {
      var pattern = "abc #category code\n123 #item number";
      var query = { sku: { $regex: pattern, $options: "x" } };
      var res = [
        products[0],
      ];
      expect(crud.find(products, query)).eql(res);
    });

  });



  describe('# $where', function() {
    var myCollection = [
      { credits : 1, debits: 0 }, // 0
      { credits : 1, debits: 1 }, // 1
      { credits : 1, debits: 2, active: false }, // 2
      { credits : 1, debits: 2, active: true }, // 3
    ];
    it('# { $where: "this.credits == this.debits" }', function() {
      var query = { $where: "this.credits == this.debits" };
      var res = [
        myCollection[1],
      ];
      expect(crud.find(myCollection, query)).eql(res);
    });
    it('# { $where: "obj.credits == obj.debits" }', function() {
      var query = { $where: "obj.credits == obj.debits" };
      var res = [
        myCollection[1],
      ];
      expect(crud.find(myCollection, query)).eql(res);
    });
    it('# { $where: function() { return (this.credits == this.debits) } }', function() {
      var query = { $where: function() { return (this.credits == this.debits) } };
      var res = [
        myCollection[1],
      ];
      expect(crud.find(myCollection, query)).eql(res);
    });
    it('# { $where: function() { return obj.credits == obj.debits; } }', function() {
      var query = { $where: function() { return obj.credits == obj.debits; } };
      var res = [
        myCollection[1],
      ];
      expect(crud.find(myCollection, query)).eql(res);
    });

    describe('# pass in just the JavaScript expression or JavaScript functions', function() {
      it('# "this.credits == this.debits || this.credits > this.debits"', function() {
        var query = "this.credits == this.debits || this.credits > this.debits";
        var res = [
          myCollection[0],
          myCollection[1],
        ];
        expect(crud.find(myCollection, query)).eql(res);
      });
      it('# function() { return (this.credits == this.debits || this.credits > this.debits ) }', function() {
        var query = function() { return (this.credits == this.debits || this.credits > this.debits ) };
        var res = [
          myCollection[0],
          myCollection[1],
        ];
        expect(crud.find(myCollection, query)).eql(res);
      });
    });

    describe('# include both the standard MongoDB operators and the $where operator', function() {
      it('# { active: true, $where: "this.credits - this.debits < 0" }', function() {
        var query = { active: true, $where: "this.credits - this.debits < 0" };
        var res = [
          myCollection[3],
        ];
        expect(crud.find(myCollection, query)).eql(res);
      });
      it('# { active: true, $where: function() { return obj.credits - obj.debits < 0; } }', function() {
        var query = { active: true, $where: function() { return obj.credits - obj.debits < 0; } };
        var res = [
          myCollection[3],
        ];
        expect(crud.find(myCollection, query)).eql(res);
      });
    });

  });

});
