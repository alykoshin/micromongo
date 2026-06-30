/**
 * $rand: a random float in [0, 1), used inside $expr to sample documents.
 */

var mm = require('../');
//var mm = require('micromongo');

// Build 2000 voters, then keep ~half at random via { $lt: [0.5, { $rand: {} }] }.
var voters = [];
for (var i = 0; i < 2000; ++i) { voters.push({ _id: i, district: 3 }); }

var picked = mm.find(voters, { $expr: { $lt: [ 0.5, { $rand: {} } ] } });

console.log('picked ~half of 2000:', picked.length);
// picked ~half of 2000: <a number near 1000, varies each run>
