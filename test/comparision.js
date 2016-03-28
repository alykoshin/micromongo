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


describe('#comparision operators - development', function() {


	describe('#primitive equal (implicit $eq)', function() {

		it('#same values', function() {
			expect(mm._match( { value: 'ab' }, { value: 'ab' } )).eql(true);
		});

		it('#different values', function() {
			expect(mm._match( { value: 'ab' }, { value: 'cd' } )).eql(false);
		});

	});


	describe('#primitive $eq', function() {

		it('#same values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $eq: 'ab' } } )).eql(true);
		});

		it('#different values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $eq: 'cd' } } )).eql(false);
		});

	});


	describe('#primitive $ne', function() {

		it('#same values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $ne: 'ab' } } )).eql(false);
		});

		it('#different values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $ne: 'cd' } } )).eql(true);
		});

	});


	describe('#primitive $gt', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $gt: 0 } } )).eql(true);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $gt: 1 } } )).eql(false);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $gt: 2 } } )).eql(false);
		});

	});


	describe('#primitive $gte', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $gte: 0 } } )).eql(true);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $gte: 1 } } )).eql(true);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $gte: 2 } } )).eql(false);
		});

	});


	describe('#primitive $lt', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $lt: 0 } } )).eql(false);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $lt: 1 } } )).eql(false);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $lt: 2 } } )).eql(true);
		});

	});


	describe('#primitive $lte', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $lte: 0 } } )).eql(false);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $lte: 1 } } )).eql(true);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $lte: 2 } } )).eql(true);
		});

	});


	describe('#primitive $in', function() {

		it('#first', function() {
			expect(mm._match( { value: 'ab' }, { value: { $in: [ 'ab', 'cd' ] } } )).eql(true);
		});

		it('#second', function() {
			expect(mm._match( { value: 'cd' }, { value: { $in: [ 'ab', 'cd' ] } } )).eql(true);
		});

		it('#none', function() {
			expect(mm._match( { value: 'de' }, { value: { $in: [ 'ab', 'cd' ] } } )).eql(false);
		});

	});


	describe('#primitive $in', function() {

		it('#first', function() {
			expect(mm._match( { value: 'ab' }, { value: { $nin: [ 'ab', 'cd' ] } } )).eql(false);
		});

		it('#second', function() {
			expect(mm._match( { value: 'cd' }, { value: { $nin: [ 'ab', 'cd' ] } } )).eql(false);
		});

		it('#none', function() {
			expect(mm._match( { value: 'de' }, { value: { $nin: [ 'ab', 'cd' ] } } )).eql(true);
		});

	});


});
