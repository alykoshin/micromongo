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


describe('#logical operators - development', function() {


	describe('#primitive $and', function() {

		it('#true,true', function() {
			expect(mm._match( {}, { $and: [ true,  true  ] } )).eql(true);
		});

		it('#true,false', function() {
			expect(mm._match( {}, { $and: [ true,  false ] } )).eql(false);
		});

		it('#false,true', function() {
			expect(mm._match( {}, { $and: [ false, true  ] } )).eql(false);
		});

		it('#false,false', function() {
			expect(mm._match({}, { $and: [ false, false ] })).eql(false);
		});

	});


	describe('#primitive $or', function() {

		it('#true,true', function() {
			expect(mm._match( {}, { $or: [ true,  true  ] } )).eql(true);
		});

		it('#true,false', function() {
			expect(mm._match( {}, { $or: [ true,  false ] } )).eql(true);
		});

		it('#false,true', function() {
			expect(mm._match( {}, { $or: [ false, true  ] } )).eql(true);
		});

		it('#false,false', function() {
			expect(mm._match( {}, { $or: [ false, false ] } )).eql(false);
		});

	});


	describe('#primitive $not', function() {

		it('#true', function() {
			expect(mm._match( {}, { $not: true  } )).eql(false);
		});

		it('#false', function() {
			expect(mm._match( {}, { $not: false } )).eql(true);
		});

	});


	describe('#primitive $nor', function() {

		it('#true,true', function() {
			expect(mm._match( {}, { $nor: [ true,  true  ] } )).eql(false);
		});

		it('#true,false', function() {
			expect(mm._match( {}, { $nor: [ true,  false ] } )).eql(false);
		});

		it('#false,true', function() {
			expect(mm._match( {}, { $nor: [ false, true  ] } )).eql(false);
		});

		it('#false,false', function() {
			expect(mm._match( {}, { $nor: [ false, false ] } )).eql(true);
		});

	});


	describe('#primitive $eq', function() {

		it('#same value', function() {
			expect(mm._match( { value1: 1 }, { value1: { $eq: 1 } } )).eql(true);
		});

		it('#different value', function() {
			expect(mm._match( { value1: 1 }, { value1: { $eq: 2 } } )).eql(false);
		});

		it('#non-existent value', function() {
			expect(mm._match( { value1: 1 }, { value2: { $eq: 1 } } )).eql(false);
		});

		it('#undefined value', function() {
			expect(mm._match( { value1: undefined }, { value2: { $eq: 1 } } )).eql(false);
		});

		it('#null value', function() {
			expect(mm._match( { value1: null }, { value2: { $eq: 1 } } )).eql(false);
		});

	});


	describe('#primitive implicit $eq', function() {

		it('#same documents', function() {
			expect(mm._match( { value1: 1, value2: 2 }, { value1: 1, value2: 2 } )).eql(true);
		});

		it('#one property is different', function() {
			expect(mm._match( { value1: 1, value2: 2 }, { value1: 2, value2: 2 } )).eql(false);
		});

		it('#one property name is different', function() {
			expect(mm._match( { value1: 1, value2: 2 }, { value1: 1, value3: 2 } )).eql(false);
		});

	});


	it('#nested $and and $or', function() {
		expect(mm._match( {}, { $and: [ { $or:  [ true,  true ] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $and: [ { $or:  [ true,  false] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $and: [ { $or:  [ false, true ] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $and: [ { $or:  [ false, false] }, true  ] } )).eql(false);
		expect(mm._match( {}, { $and: [ { $or:  [ true,  true ] }, false ] } )).eql(false);
		expect(mm._match( {}, { $and: [ { $or:  [ true,  false] }, false ] } )).eql(false);
		expect(mm._match( {}, { $and: [ { $or:  [ false, true ] }, false ] } )).eql(false);
		expect(mm._match( {}, { $and: [ { $or:  [ false, false] }, false ] } )).eql(false);

		expect(mm._match( {}, { $or:  [ { $and: [ true,  true ] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $or:  [ { $and: [ true,  false] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $or:  [ { $and: [ false, true ] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $or:  [ { $and: [ false, false] }, true  ] } )).eql(true);
		expect(mm._match( {}, { $or:  [ { $and: [ true,  true ] }, false ] } )).eql(true);
		expect(mm._match( {}, { $or:  [ { $and: [ true,  false] }, false ] } )).eql(false);
		expect(mm._match( {}, { $or:  [ { $and: [ false, true ] }, false ] } )).eql(false);
		expect(mm._match( {}, { $or:  [ { $and: [ false, false] }, false ] } )).eql(false);
	});

	it('#$and for primitive implicit $eq', function() {
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 1 }, { value2: 2 } ] } )).eql(true);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 2 }, { value2: 2 } ] } )).eql(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 1 }, { value2: 1 } ] } )).eql(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 2 }, { value2: 1 } ] } )).eql(false);
	});

	it('#$and for primitive $eq', function() {
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 1 } }, { value2: { $eq: 2 } } ] } )).eql(true);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 2 } }, { value2: { $eq: 2 } } ] } )).eql(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 1 } }, { value2: { $eq: 1 } } ] } )).eql(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 2 } }, { value2: { $eq: 1 } } ] } )).eql(false);
	});

});
