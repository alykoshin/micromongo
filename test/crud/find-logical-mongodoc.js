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


describe('#logical operators - mongo docs', function() {

	describe('#$or', function () {

		var array = [
			{ quantity: 10, price: 10 },
			{ quantity: 10, price:  0 },
			{ quantity: 20, price: 10 },
			{ quantity: 20, price:  0 },
			{ quantity: 30, price: 10 },
			{ quantity: 30, price:  0 },
		];

		it('#{ $or: [ { quantity: { $lt: 20 } }, { price: 10 } ] }', function () {
			var query = { $or: [ { quantity: { $lt: 20 } }, { price: 10 } ] };
			var res   = [
				{ quantity: 10, price: 10 },
				{ quantity: 10, price:  0 },
				{ quantity: 20, price: 10 },
				{ quantity: 30, price: 10 },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('Nested $or Clauses');

	});

	describe('#$and', function () {
		it('#AND Queries With Multiple Expressions Specifying the Same Field', function() {
			var array = [
				{ },
				{ price: 0.99 },
				{ price: 1.99 },
			];
			var query = { $and: [ { price: { $ne: 1.99 } }, { price: { $exists: true } } ] };
			var res   = [
				{ price: 0.99 },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#implicit $and', function() {
			var array = [
				{ },
				{ price: 0.99 },
				{ price: 1.99 },
			];
			var query = { price: { $ne: 1.99, $exists: true } };
			var res   = [
				{ price: 0.99 },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#AND Queries With Multiple Expressions Specifying the Same Operator', function() {
			var array = [
				{ qty: 10, sale: true               }, // 0
				{ qty: 30, sale: true               }, // 1
				{ qty: 10, sale: true,  price: 0.99 }, // 2
				{ qty: 30, sale: true,  price: 0.99 }, // 3
				{ qty: 10, sale: false, price: 0.99 }, // 4
				{ qty: 30, sale: false, price: 0.99 }, // 5
				{ qty: 10, sale: true,  price: 1.99 }, // 6
				{ qty: 30, sale: true,  price: 1.99 }, // 7
				{ qty: 10, sale: false, price: 1.99 }, // 8
				{ qty: 30, sale: false, price: 1.99 }, // 9
			];
			var query = {
				$and : [
					{ $or : [ { price : 0.99 }, { price : 1.99 } ] },
					{ $or : [ { sale : true }, { qty : { $lt : 20 } } ] }
				]
			};
			var res   = [
        array[2],
        array[3],
        array[4],
        array[6],
        array[7],
        array[8],
			];
			expect(crud.find(array, query)).eql(res);
		});

	});

	describe('#$not', function () {
		it('$not');
	});

	describe('#$nor', function () {
		it('$nor');
	});


});
