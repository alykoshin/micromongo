'use strict';

var crud = require('./crud/');
var aggregate = require('./aggregate/');


module.exports = {
  count: crud.count,
  copyTo: crud.copyTo,

  find: crud.find,
  findOne: crud.findOne,

  deleteOne: crud.deleteOne,
  deleteMany: crud.deleteMany,
  remove: crud.remove,

  insertOne: crud.insertOne,
  insertMany: crud.insertMany,
  insert: crud.insert,

  aggregate: aggregate,
};
