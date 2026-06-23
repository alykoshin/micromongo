/**
 * Element query postOperators: $exists, $type.
 */

'use strict';

var assert = require('assert');

var registry = require('../registry');


registry.registerOperator('post', '$exists', function (doc, query) {
  assert(typeof query === 'boolean', 'Invalid syntax near \'' + JSON.stringify(query) + '\': parameter for $exists must be boolean.');
  var q = query;
  return (
    (q === true  && typeof doc !== 'undefined') ||
    (q === false && typeof doc === 'undefined')
  );
});

registry.registerOperator('post', '$type', function (doc, query) {
  var allowedDataTypes = [
    'boolean', 'null', 'number', 'object', 'string', 'undefined', // standard Javascript types; object includes null and array
    'array'                                                       // non-standard Javascript types
  ];
  if ( typeof query !== 'string' || allowedDataTypes.indexOf(query) < 0) {
    throw new Error('Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $type must be one of following types: '+allowedDataTypes.join(', ')+'.');
  }
  return (
    (query === typeof doc) ||
    (query === 'null'  && doc === null) ||
    (query === 'array' && Array.isArray(doc))
  );
});
