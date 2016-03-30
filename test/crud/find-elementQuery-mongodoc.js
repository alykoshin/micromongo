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


describe('#element query operators - mongo docs', function() {

	var array = [
		{ a: 5, b: 5, c: null },
		{ a: 3, b: null, c: 8 },
		{ a: null, b: 3, c: 9 },
		{ a: 1, b: 2, c: 3 },
		{ a: 2, c: 5 },
		{ a: 3, b: 2 },
		{ a: 4 },
		{ b: 2, c: 4 },
		{ b: 2 },
		{ c: 6 },
	];


	it('#Exists and Not Equal To', function() {
		var array = [
			{ qty: null },
			{ qty: undefined, value: 'the name is undefined' },
			{ qty: 5 },
			{ qty: 15 },
			{ qty: 20 },
		];
		var query = { qty: { $exists: true, $nin: [ 5, 15 ] } };
		var res = [
			{ qty: null },
			{ qty: 20 },
		];
		expect(crud.find(array, query)).eql(res);
	});

	it('#Null Values: $exists: true', function() {
		var query = { a: { $exists: true } };
		var res = [
			{ a: 5, b: 5, c: null },
			{ a: 3, b: null, c: 8 },
			{ a: null, b: 3, c: 9 },
			{ a: 1, b: 2, c: 3 },
			{ a: 2, c: 5 },
			{ a: 3, b: 2 },
			{ a: 4 },
		];
		expect(crud.find(array, query)).eql(res);
	});

	it('#Null Values: $exists: false', function() {
		var query = { b: { $exists: false } };
		var res = [
			{ a: 2, c: 5 },
			{ a: 4 },
			{ c: 6 },
		];
		expect(crud.find(array, query)).eql(res);
	});


});
