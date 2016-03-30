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


// https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/

describe('#projection - mongo docs', function() {

	it('#Return All Fields in Matching Documents', function() {

		var a = [{ value: 'ab' }];
		var q = {};
		var p = {};
		var r = a;
		expect(crud.find( a, q, p )).eql( r );

	});

	it('#Return the Specified Fields and the _id Field Only *** Original Mongo handles _id differently ***', function() {
		var a = [
			{ type: 'food', item: 'item', qty: 1 },
			{ type: 'not-a-food', item: 'item', qty: 1 }
		];
		var q = { type: 'food' };
		var p = { item: 1, qty: 1 };
		var r = [
			{ item: 'item', qty: 1}
		];
		expect(crud.find( a, q, p )).eql( r );
	});

	it('#Return Specified Fields Only *** Original Mongo handles _id differently ***', function() {
		var a = [
			{ type: 'food', item: 'item', qty: 1 },
			{ type: 'not-a-food', item: 'item', qty: 1 }
		];
		var q = { type: 'food' };
		var p = { item: 1, qty: 1, _id: 0 };
		var r = [
			{ item: 'item', qty: 1}
		];
		expect(crud.find( a, q, p )).eql( r );
	});

	it('#Return All But the Excluded Field', function() {
		var a = [
			{ type: 'food', item: 'item', qty: 1 },
			{ type: 'not-a-food', item: 'item', qty: 1 }
		];
		var q = { type: 'food' };
		var p = { type: 0 };
		var r = [
			{ item: 'item', qty: 1 },
		];
		expect(crud.find( a, q, p )).eql( r );
	});

	it('#Return Specific Fields in Embedded Documents', function() {
		var a = [
			{
				'_id' : 3,
				'type' : 'food',
				'item' : 'aaa',
				'classification': { dept: 'grocery', category: 'chocolate'  }
			}
		];
		var q = { type: 'food', _id: 3 };
		var p = { 'classification.category': 1, _id: 0 };
		var r = [
			{
				'classification': { category: 'chocolate'  }
			}
		];
		expect(crud.find( a, q, p )).eql( r );
	});

	it('#Suppress Specific Fields in Embedded Documents', function() {
		var a = [
			{
				'_id' : 3,
				'type' : 'food',
				'item' : 'Super Dark Chocolate',
				'classification' : { 'dept' : 'grocery', 'category' : 'chocolate'},
				'vendor' : {
					'primary' : {
						'name' : 'Marsupial Vending Co',
						'address' : 'Wallaby Rd',
						'delivery' : ['M','W','F']
					},
					'secondary':{
						'name' : 'Intl. Chocolatiers',
						'address' : 'Cocoa Plaza',
						'delivery' : ['Sa']
					}
				}
			}
		];
		var q = { type: 'food', _id: 3 };
		var p = { 'classification.category': 0};
		var r = [
			{
				'_id' : 3,
				'type' : 'food',
				'item' : 'Super Dark Chocolate',
				'classification' : { 'dept' : 'grocery'},
				'vendor' : {
					'primary' : {
						'name' : 'Marsupial Vending Co', // 'Bobs Vending', -- error in Mongo docs
						'address' : 'Wallaby Rd',
						'delivery' : ['M','W','F']
					},
					'secondary':{
						'name' : 'Intl. Chocolatiers',
						'address' : 'Cocoa Plaza',
						'delivery' : ['Sa']
					}
				}
			}
		];
		expect(crud.find( a, q, p )).eql( r );
	});

	it('#Projection for Array Fields');

});
