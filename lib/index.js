'use strict';

var crud = require('./crud/');
var aggregate = require('./aggregate/');
var settings = require('./settings');


module.exports = {
  configure: settings.configure,

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

  _crud: crud,
  aggregate: aggregate,
};
