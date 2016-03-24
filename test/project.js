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


describe('#projection - development', function() {
	var doc, projection, res;

	it('#primitive projection', function() {

		doc = { value: 'ab' };

		projection = {};
		res = { value: 'ab' };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value: 1 };
		res = { value: 'ab' };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value: 0 };
		res = {};
		expect(mm._project( doc, projection )).eql( res );

		doc = { value1: 1, value2: 2 };

		projection = { value1: 1, value2: 1 };
		res = { value1: 1, value2: 2 };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value1: 1 };
		res = { value1: 1 };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value2: 1 };
		res = { value2: 2 };
		expect(mm._project( doc, projection )).eql( res );


		projection = { value1: 0, value2: 0 };
		res = { };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value1: 0 };
		res = { value2: 2 };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value2: 0 };
		res = { value1: 1 };
		expect(mm._project( doc, projection )).eql( res );


		projection = { value1: 0, value2: 1 };
		expect(function() {
			mm._project( doc, projection );
		}).throw(Error);

		projection = { value1: 1, value2: 0 };
		expect(function() {
			mm._project( doc, projection );
		}).throw(Error);

		projection = { value: -1, value2: 0 };
		expect(function() {
			mm._project( doc, projection );
		}).throw(Error);

	});


	it('#projection for embedded documents', function() {

		doc = { value1: { value2: 'ab' } };

		projection = { 'value1.value2': 1 };
		res = { value1: { value2: 'ab' } };
		expect(mm._project( doc, projection )).eql( res );

		projection = { 'value1.value2': 0 };
		res = { value1 : {} };
		expect(mm._project( doc, projection )).eql( res );

		projection = { value1: 0 };
		res = {};
		expect(mm._project( doc, projection )).eql( res );

		projection = { value2: 0 };
		res = doc;
		expect(mm._project( doc, projection )).eql( res );

	});

	it('#projection for _id');

});
