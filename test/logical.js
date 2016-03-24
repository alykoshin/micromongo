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
			expect(mm._match( {}, { $and: [ true,  true  ] } )).equals(true);
		});

		it('#true,false', function() {
			expect(mm._match( {}, { $and: [ true,  false ] } )).equals(false);
		});

		it('#false,true', function() {
			expect(mm._match( {}, { $and: [ false, true  ] } )).equals(false);
		});

		it('#false,false', function() {
			expect(mm._match({}, { $and: [ false, false ] })).equals(false);
		});

	});


	describe('#primitive $or', function() {

		it('#true,true', function() {
			expect(mm._match( {}, { $or: [ true,  true  ] } )).equals(true);
		});

		it('#true,false', function() {
			expect(mm._match( {}, { $or: [ true,  false ] } )).equals(true);
		});

		it('#false,true', function() {
			expect(mm._match( {}, { $or: [ false, true  ] } )).equals(true);
		});

		it('#false,false', function() {
			expect(mm._match( {}, { $or: [ false, false ] } )).equals(false);
		});

	});


	describe('#primitive $not', function() {

		it('#true', function() {
			expect(mm._match( {}, { $not: true  } )).equals(false);
		});

		it('#false', function() {
			expect(mm._match( {}, { $not: false } )).equals(true);
		});

	});


	describe('#primitive $nor', function() {

		it('#true,true', function() {
			expect(mm._match( {}, { $nor: [ true,  true  ] } )).equals(false);
		});

		it('#true,false', function() {
			expect(mm._match( {}, { $nor: [ true,  false ] } )).equals(false);
		});

		it('#false,true', function() {
			expect(mm._match( {}, { $nor: [ false, true  ] } )).equals(false);
		});

		it('#false,false', function() {
			expect(mm._match( {}, { $nor: [ false, false ] } )).equals(true);
		});

	});


	describe('#primitive $eq', function() {

		it('#same value', function() {
			expect(mm._match( { value1: 1 }, { value1: { $eq: 1 } } )).equals(true);
		});

		it('#different value', function() {
			expect(mm._match( { value1: 1 }, { value1: { $eq: 2 } } )).equals(false);
		});

		it('#non-existent value', function() {
			expect(mm._match( { value1: 1 }, { value2: { $eq: 1 } } )).equals(false);
		});

		it('#undefined value', function() {
			expect(mm._match( { value1: undefined }, { value2: { $eq: 1 } } )).equals(false);
		});

		it('#null value', function() {
			expect(mm._match( { value1: null }, { value2: { $eq: 1 } } )).equals(false);
		});

	});


	describe('#primitive implicit $eq', function() {

		it('#same documents', function() {
			expect(mm._match( { value1: 1, value2: 2 }, { value1: 1, value2: 2 } )).equals(true);
		});

		it('#one property is different', function() {
			expect(mm._match( { value1: 1, value2: 2 }, { value1: 2, value2: 2 } )).equals(false);
		});

		it('#one property name is different', function() {
			expect(mm._match( { value1: 1, value2: 2 }, { value1: 1, value3: 2 } )).equals(false);
		});

	});


	it('#nested $and and $or', function() {
		expect(mm._match( {}, { $and: [ { $or:  [ true,  true ] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $and: [ { $or:  [ true,  false] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $and: [ { $or:  [ false, true ] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $and: [ { $or:  [ false, false] }, true  ] } )).equals(false);
		expect(mm._match( {}, { $and: [ { $or:  [ true,  true ] }, false ] } )).equals(false);
		expect(mm._match( {}, { $and: [ { $or:  [ true,  false] }, false ] } )).equals(false);
		expect(mm._match( {}, { $and: [ { $or:  [ false, true ] }, false ] } )).equals(false);
		expect(mm._match( {}, { $and: [ { $or:  [ false, false] }, false ] } )).equals(false);

		expect(mm._match( {}, { $or:  [ { $and: [ true,  true ] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $or:  [ { $and: [ true,  false] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $or:  [ { $and: [ false, true ] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $or:  [ { $and: [ false, false] }, true  ] } )).equals(true);
		expect(mm._match( {}, { $or:  [ { $and: [ true,  true ] }, false ] } )).equals(true);
		expect(mm._match( {}, { $or:  [ { $and: [ true,  false] }, false ] } )).equals(false);
		expect(mm._match( {}, { $or:  [ { $and: [ false, true ] }, false ] } )).equals(false);
		expect(mm._match( {}, { $or:  [ { $and: [ false, false] }, false ] } )).equals(false);
	});

	it('#$and for primitive implicit $eq', function() {
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 1 }, { value2: 2 } ] } )).equals(true);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 2 }, { value2: 2 } ] } )).equals(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 1 }, { value2: 1 } ] } )).equals(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: 2 }, { value2: 1 } ] } )).equals(false);
	});

	it('#$and for primitive $eq', function() {
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 1 } }, { value2: { $eq: 2 } } ] } )).equals(true);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 2 } }, { value2: { $eq: 2 } } ] } )).equals(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 1 } }, { value2: { $eq: 1 } } ] } )).equals(false);
		expect(mm._match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 2 } }, { value2: { $eq: 1 } } ] } )).equals(false);
	});

});
