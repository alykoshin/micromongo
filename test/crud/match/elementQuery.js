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


describe('#element query operators - development', function() {


	describe('#primitive $exists', function() {

		describe('#value exists', function() {

			it('#$exists: true', function() {
				expect(match( { prop1: 1 }, { prop1: { $exists: true  } } )).eql(true);
			});

			it('#$exists: false', function() {
				expect(match( { prop1: 1 }, { prop1: { $exists: false } } )).eql(false);
			});

		});


		describe('#value not exists ', function() {

			it('#$exists: true', function() {
				expect(match( { prop1: 1 }, { prop2: { $exists: true  } } )).eql(false);
			});

			it('#$exists: false', function() {
				expect(match( { prop1: 1 }, { prop2: { $exists: false } } )).eql(true);
			});

		});


		describe('#value undefined', function() {

			it('#$exists: true', function() {
				expect(match( { prop1: undefined }, { prop1: { $exists: true  } } )).eql(false);
			});

			it('#$exists: false', function() {
				expect(match( { prop1: undefined }, { prop1: { $exists: false } } )).eql(true);
			});

		});

		describe('#value null', function() {

			it('#$exists: true', function() {
				expect(match( { prop1: null }, { prop1: { $exists: true  } } )).eql(true);
			});

			it('#$exists: false', function() {
				expect(match( { prop1: null }, { prop1: { $exists: false } } )).eql(false);
			});

		});

	});


	describe('#primitive $type - find()', function() {
		var query, res;
		var array = [
			{ name: null },
			{ name: undefined, value: 'the name is undefined' },
			{ name: false },
			{ name: true },
			{ name: 1 },
			{ name: 'text' },
			{ name: {} },
			{ name: { value: 'xyz' } },
			{ name: [] },
			{ name: [ 1, 2, 3 ] }
		];

		it('#$type: "null"', function() {
			query = { name: { $type: 'null' } };
			res = [
				{ name: null }
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#$type: "undefined"', function() {
			query = { name: { $type: 'undefined' } };
			res = [
				// !!! at some function call 'name: undefined' is removed by node itself
				{ name: undefined, value: 'the name is undefined' },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#$type: "boolean"', function() {
			query = { name: { $type: 'boolean' } };
			res = [
				{ name: false },
				{ name: true },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#$type: "number"', function() {
			query = { name: { $type: 'number' } };
			res = [
				{ name: 1 },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#$type: "string"', function() {
			query = { name: { $type: 'string' } };
			res = [
				{ name: 'text' },
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#$type: "object" (null, empty object, normal object, empty array, normal array', function() {
			query = { name: { $type: 'object' } };
			res = [
				{ name: null },
				{ name: {} },
				{ name: { value: 'xyz' } },
				{ name: [] },
				{ name: [ 1, 2, 3 ] }
			];
			expect(crud.find(array, query)).eql(res);
		});

		it('#$type: "object" ()', function() {
			query = { name: { $type: 'array' } };
			res = [
				{ name: [] },
				{ name: [ 1, 2, 3 ] }
			];
			expect(crud.find(array, query)).eql(res);
		});

	});


});
