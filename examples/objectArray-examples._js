'use strict';

var oa = require('./objectArray');

var arr, arr1, arr2, q;


var arr = [ { value: true } ];

console.log('\n*** find($and/$or) ***');

// primitive $and
//q = { $and: [ true, true ] };
//console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
//q = { $and: [ true, false ] };
//console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
//q = { $and: [ false, false ] };
//console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));

// primitive $or
//q = { $or: [ true, true ] };
//console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
//q = { $or: [ true, false ] };
//console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
//q = { $or: [ false, false ] };
//console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));

// recursive $and/$or
q = { $and: [ { $or: [ true, true] }, true ] };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { $and: [ { $or: [ false, false] }, true ] };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));


process.exit(0);


arr = [
	{ "name": "ab", "prop1": "value11" },
	{ "name": "ab", "prop1": "value12" },
	{ "name": "cd", "prop2": "value2"  },
	{ "name": "de", "prop3": "value3"  }
];

console.log('arr:\n', arr);



console.log('\n*** misc ***');
console.log('oa.keyValues(arr, "name") = ' + JSON.stringify( oa.keyValues(arr, "name") ));


console.log('\n*** find() ***');

q = { name: "ab" };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));

q = { name: { $in: [ "ab", "cd" ] } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));

q = { prop1: { $exists: true } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));

q = { prop1: { $exists: false } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));


arr = [
	{ name: null },
	{ name: undefined, value: 'the name is undefined' },
	{ name: true },
	{ name: 1 },
	{ name: 'text' },
	{ name: {} },
	{ name: { value: 'xyz' } },
	{ name: [] },
	{ name: [ 1, 2, 3 ] }
];

console.log('arr:\n', arr);

q = { name: { $type: 'null' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { name: { $type: 'undefined' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { name: { $type: 'boolean' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { name: { $type: 'number' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { name: { $type: 'string' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { name: { $type: 'object' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));
q = { name: { $type: 'array' } };
console.log('oa.find(arr, '+JSON.stringify(q)+') = '+JSON.stringify(oa.find(arr, q)));



console.log('\n*** outerJoin() ***');

arr1 = [
	{ "name": "ab", "prop1": "value11" },
	{ "name": "cd", "prop2": "value2"  }
];
arr2 = [
	{ "name": "ab", "prop1": "value12" },
	{ "name": "de", "prop2": "value3"  }
];
console.log('arr1:\n', arr1);
console.log('arr2:\n', arr2);
console.log(
	'oa.outerJoin(arr1, arr2, "name") = ',
	oa.outerJoin(arr1, arr2, "name"));


console.log('oa.haveAllKeys([1,2], [1,2]) = ' + JSON.stringify( oa.haveAllKeys([1,2], [1,2]) ));
console.log('oa.haveAllKeys([1  ], [1,2]) = ' + JSON.stringify( oa.haveAllKeys([1  ], [1,2]) ));
console.log('oa.haveAllKeys([1,2], [1  ]) = ' + JSON.stringify( oa.haveAllKeys([1,2], [1  ]) ));
console.log('oa.haveAllKeys([1,2], [1,3]) = ' + JSON.stringify( oa.haveAllKeys([1,2], [1,3]) ));

console.log('oa.containAllKeys([1,2], [1,2]) = ' + JSON.stringify( oa.containAllKeys([1,2], [1,2]) ));
console.log('oa.containAllKeys([1  ], [1,2]) = ' + JSON.stringify( oa.containAllKeys([1  ], [1,2]) ));
console.log('oa.containAllKeys([1,2], [1  ]) = ' + JSON.stringify( oa.containAllKeys([1,2], [1  ]) ));
console.log('oa.containAllKeys([1,2], [1,3]) = ' + JSON.stringify( oa.containAllKeys([1,2], [1,3]) ));

