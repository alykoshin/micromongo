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
			expect(mm._match( { value: 'ab' }, { value: 'ab' } )).equals(true);
		});

		it('#different values', function() {
			expect(mm._match( { value: 'ab' }, { value: 'cd' } )).equals(false);
		});

	});


	describe('#primitive $eq', function() {

		it('#same values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $eq: 'ab' } } )).equals(true);
		});

		it('#different values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $eq: 'cd' } } )).equals(false);
		});

	});


	describe('#primitive $ne', function() {

		it('#same values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $ne: 'ab' } } )).equals(false);
		});

		it('#different values', function() {
			expect(mm._match( { value: 'ab' }, { value: { $ne: 'cd' } } )).equals(true);
		});

	});


	describe('#primitive $gt', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $gt: 0 } } )).equals(true);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $gt: 1 } } )).equals(false);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $gt: 2 } } )).equals(false);
		});

	});


	describe('#primitive $gte', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $gte: 0 } } )).equals(true);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $gte: 1 } } )).equals(true);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $gte: 2 } } )).equals(false);
		});

	});


	describe('#primitive $lt', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $lt: 0 } } )).equals(false);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $lt: 1 } } )).equals(false);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $lt: 2 } } )).equals(true);
		});

	});


	describe('#primitive $lte', function() {

		it('#greater', function() {
			expect(mm._match( { value: 1 }, { value: { $lte: 0 } } )).equals(false);
		});

		it('#equal', function() {
			expect(mm._match( { value: 1 }, { value: { $lte: 1 } } )).equals(true);
		});

		it('#less', function() {
			expect(mm._match( { value: 1 }, { value: { $lte: 2 } } )).equals(true);
		});

	});


	describe('#primitive $in', function() {

		it('#first', function() {
			expect(mm._match( { value: 'ab' }, { value: { $in: [ 'ab', 'cd' ] } } )).equals(true);
		});

		it('#second', function() {
			expect(mm._match( { value: 'cd' }, { value: { $in: [ 'ab', 'cd' ] } } )).equals(true);
		});

		it('#none', function() {
			expect(mm._match( { value: 'de' }, { value: { $in: [ 'ab', 'cd' ] } } )).equals(false);
		});

	});


	describe('#primitive $in', function() {

		it('#first', function() {
			expect(mm._match( { value: 'ab' }, { value: { $nin: [ 'ab', 'cd' ] } } )).equals(false);
		});

		it('#second', function() {
			expect(mm._match( { value: 'cd' }, { value: { $nin: [ 'ab', 'cd' ] } } )).equals(false);
		});

		it('#none', function() {
			expect(mm._match( { value: 'de' }, { value: { $nin: [ 'ab', 'cd' ] } } )).equals(true);
		});

	});


});
