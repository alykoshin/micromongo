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


describe('#logical operators - development', function() {


	describe('#primitive $and', function() {

		it('#true,true', function() {
			expect(match( {}, { $and: [ true,  true  ] } )).eql(true);
		});

		it('#true,false', function() {
			expect(match( {}, { $and: [ true,  false ] } )).eql(false);
		});

		it('#false,true', function() {
			expect(match( {}, { $and: [ false, true  ] } )).eql(false);
		});

		it('#false,false', function() {
			expect(match({}, { $and: [ false, false ] })).eql(false);
		});

	});


	describe('#primitive $or', function() {

		it('#true,true', function() {
			expect(match( {}, { $or: [ true,  true  ] } )).eql(true);
		});

		it('#true,false', function() {
			expect(match( {}, { $or: [ true,  false ] } )).eql(true);
		});

		it('#false,true', function() {
			expect(match( {}, { $or: [ false, true  ] } )).eql(true);
		});

		it('#false,false', function() {
			expect(match( {}, { $or: [ false, false ] } )).eql(false);
		});

	});


	//describe('#primitive $not', function() {
  //
	//	it('#true', function() {
	//		expect(match( {}, { $not: true  } )).eql(false);
	//	});
  //
	//	it('#false', function() {
	//		expect(match( {}, { $not: false } )).eql(true);
	//	});
  //
	//});


	describe('# query $not $eq', function() {

		it('# field $not $eq - match', function() {
			expect(match( { a: 1 }, { a: { $not: { $eq: 1 } } } )).eql(false);
		});

		it('# field $not $eq - not match', function() {
			expect(match( { a: 1 }, { a: { $not: { $eq: 10 } } } )).eql(true);
		});

	});


	describe('# query $not $size', function() {

		it('# field $not $eq - match', function() {
			expect(match( { a: [ 1, 2, 3 ] }, { a: { $not: { $size: 3 } } } )).eql(false);
		});

		it('# field $not $eq - not match', function() {
			expect(match( { a: [ 1, 2, 3 ] }, { a: { $not: { $size: 0 } } } )).eql(true);
		});

	});


	describe('#primitive $nor', function() {

		it('#true,true', function() {
			expect(match( {}, { $nor: [ true,  true  ] } )).eql(false);
		});

		it('#true,false', function() {
			expect(match( {}, { $nor: [ true,  false ] } )).eql(false);
		});

		it('#false,true', function() {
			expect(match( {}, { $nor: [ false, true  ] } )).eql(false);
		});

		it('#false,false', function() {
			expect(match( {}, { $nor: [ false, false ] } )).eql(true);
		});

	});


	describe('#primitive $eq', function() {

		it('#same value', function() {
			expect(match( { value1: 1 }, { value1: { $eq: 1 } } )).eql(true);
		});

		it('#different value', function() {
			expect(match( { value1: 1 }, { value1: { $eq: 2 } } )).eql(false);
		});

		it('#non-existent value', function() {
			expect(match( { value1: 1 }, { value2: { $eq: 1 } } )).eql(false);
		});

		it('#undefined value', function() {
			expect(match( { value1: undefined }, { value2: { $eq: 1 } } )).eql(false);
		});

		it('#null value', function() {
			expect(match( { value1: null }, { value2: { $eq: 1 } } )).eql(false);
		});

	});


	describe('#primitive implicit $eq', function() {

		it('#same documents', function() {
			expect(match( { value1: 1, value2: 2 }, { value1: 1, value2: 2 } )).eql(true);
		});

		it('#one property is different', function() {
			expect(match( { value1: 1, value2: 2 }, { value1: 2, value2: 2 } )).eql(false);
		});

		it('#one property name is different', function() {
			expect(match( { value1: 1, value2: 2 }, { value1: 1, value3: 2 } )).eql(false);
		});

	});


	describe('# implicit $eq - composite (1)', function() {

		it('#same', function() {
			expect(match( { value1: { value2: 2 } }, { value1: { value2: 2 } } )).eql(true);
		});

		it('#different value', function() {
			expect(match( { value1: { value2: 2 } }, { value1: { value2: 1 } } )).eql(false);
		});

		it('#different name', function() {
			expect(match( { value1: { value2: 2 } }, { value1: { value3: 1 } } )).eql(false);
		});

		it('#different name', function() {
			expect(match( { value1: { value2: 2 } }, { value2: { value2: 1 } } )).eql(false);
		});

});

	describe('# implicit $eq - composite (2)', function() {

		it('#same', function() {
			expect(match( { value1: { value2: 2 } }, { 'value1.value2': 2 } )).eql(true);
		});

		it('#different', function() {
			expect(match( { value1: { value2: 2 } }, { 'value1.value2': 1 } )).eql(false);
		});

});


	it('#nested $and and $or', function() {
		expect(match( {}, { $and: [ { $or:  [ true,  true ] }, true  ] } )).eql(true);
		expect(match( {}, { $and: [ { $or:  [ true,  false] }, true  ] } )).eql(true);
		expect(match( {}, { $and: [ { $or:  [ false, true ] }, true  ] } )).eql(true);
		expect(match( {}, { $and: [ { $or:  [ false, false] }, true  ] } )).eql(false);
		expect(match( {}, { $and: [ { $or:  [ true,  true ] }, false ] } )).eql(false);
		expect(match( {}, { $and: [ { $or:  [ true,  false] }, false ] } )).eql(false);
		expect(match( {}, { $and: [ { $or:  [ false, true ] }, false ] } )).eql(false);
		expect(match( {}, { $and: [ { $or:  [ false, false] }, false ] } )).eql(false);

		expect(match( {}, { $or:  [ { $and: [ true,  true ] }, true  ] } )).eql(true);
		expect(match( {}, { $or:  [ { $and: [ true,  false] }, true  ] } )).eql(true);
		expect(match( {}, { $or:  [ { $and: [ false, true ] }, true  ] } )).eql(true);
		expect(match( {}, { $or:  [ { $and: [ false, false] }, true  ] } )).eql(true);
		expect(match( {}, { $or:  [ { $and: [ true,  true ] }, false ] } )).eql(true);
		expect(match( {}, { $or:  [ { $and: [ true,  false] }, false ] } )).eql(false);
		expect(match( {}, { $or:  [ { $and: [ false, true ] }, false ] } )).eql(false);
		expect(match( {}, { $or:  [ { $and: [ false, false] }, false ] } )).eql(false);
	});

	it('#$and for primitive implicit $eq', function() {
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: 1 }, { value2: 2 } ] } )).eql(true);
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: 2 }, { value2: 2 } ] } )).eql(false);
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: 1 }, { value2: 1 } ] } )).eql(false);
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: 2 }, { value2: 1 } ] } )).eql(false);
	});

	it('#$and for primitive $eq', function() {
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 1 } }, { value2: { $eq: 2 } } ] } )).eql(true);
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 2 } }, { value2: { $eq: 2 } } ] } )).eql(false);
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 1 } }, { value2: { $eq: 1 } } ] } )).eql(false);
		expect(match( { value1: 1, value2: 2 }, { $and: [ { value1: { $eq: 2 } }, { value2: { $eq: 1 } } ] } )).eql(false);
	});

});
