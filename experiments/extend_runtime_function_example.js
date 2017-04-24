/**
 *
 * This file is an example how to extend the functionality of `micromongo` in runtime
 *
 * It shows how to add new function `$userFn` to CRUD `match` functions
 * and use it in `find` function
 *
 */

"use strict";


//const mm = require('micromongo');
const mm = require('../');

const data = [
  { user: { Name: 'User1234',  UserId: '1234' } },
  { user: { Name: 'UserXXXX',  UserId: '1234' } },
];

console.log('Extending postOperators with new $userFn function...');

mm._crud._match.postOperators.$userFn = function(doc, query) {
  console.log('Inside $userFn(): doc', doc, ' query:', query);
  return doc.Name !== 'User'+doc.UserId;
};

console.log('Running the query with new $userFn function...');

const query = {
  $and: [
    { user: {$userFn: true}, },
  ]
};

let res = mm.find(data, query);

console.log(res);
