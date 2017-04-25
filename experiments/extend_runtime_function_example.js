/**
 *
 * This file is an example how to extend the functionality of `micromongo` in runtime
 *
 * It shows how to add new functions to CRUD `match` functions
 * and use it in `find` function
 *
 */

"use strict";


//const mm = require('micromongo');
const mm = require('../');

const data1 = [
  { user: { Name: 'User1234',  UserId: '1234' } },
  { user: { Name: 'UserXXXX',  UserId: '1234' } },
];

console.log('\n* Extending postOperators with new $userFn1 function...');

mm._crud._match.postOperators.$userFn1 = function(doc, query) {
  const res = (doc.Name !== 'User'+doc.UserId);
  console.log('** Inside $userFn1(): doc', doc, ' query:', query, 'res:', res);
  return res;
};

console.log('* Running the query with new $userFn1 function...');

const query1 = {
  $and: [
    { user: {$userFn1: true}, },
  ]
};

let res1 = mm.find(data1, query1);

console.log('* res1:', res1);

////////////////////////////////////////////////////////////////////////////////

const data2 = [
  { Name: 'User1234',  UserId: '1234' },
  { Name: 'UserXXXX',  UserId: '1234' },
];

console.log('\n* Extending preOperators with new $userFn2 function...');

mm._crud._match.preOperators.$userFn2 = function(doc, query) {
  const res = (doc.Name !== 'User'+doc.UserId);
  console.log('** Inside $userFn2(): doc', doc, ' query:', query, 'res:', res);
  return res;
};

console.log('* Running the query with new $userFn2 function...');

const query2 = {
  $and: [
    { $userFn2: true },
  ]
};

let res2 = mm.find(data2, query2);

console.log('* res2:', res2);

////////////////////////////////////////////////////////////////////////////////

const data3 = [
  { Name: 'User1234',  UserId: '1234' },
  { Name: 'UserXXXX',  UserId: '1234' },
];

console.log('\n* Extending preOperators with new $userFn3 function...');

mm._crud._match.preOperators.$userFn3 = function(doc, query) {
  const res = (doc[query.name1] !== query.value + doc[query.name2]);
  console.log('** Inside $userFn3(): doc', doc, ' query:', query, 'res:', res);
  return res;
};

console.log('* Running the query with new $userFn3 function...');

const query3 = {
  $and: [
    { $userFn3: { name1: 'Name', name2: 'UserId', value: 'User' } },
  ]
};

let res3 = mm.find(data3, query3);

console.log('* res3:', res3);

////////////////////////////////////////////////////////////////////////////////

