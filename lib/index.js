'use strict';

var crud = require('./crud/');
var aggregate = require('./aggregate/');
var settings = require('./settings');
var Collection = require('./collection');
var Cursor = require('./cursor');
var registry = require('./registry');


/**
 * Register or retrieve a named collection (micromongo's `db.collection(name)`).
 *
 *   mm.collection('orders', ordersArray)  // create/replace from an array → Collection
 *   mm.collection('orders', someColl)     // register an existing Collection
 *   mm.collection('orders')               // retrieve (creates an empty one if absent,
 *                                         //  matching Mongo's lazy-collection behavior)
 *
 * Named collections are resolvable by `$out`/`$lookup` via their string name.
 */
function collection(name, array) {
  if (typeof name !== 'string') { throw new TypeError('collection(name): name must be a string'); }
  if (typeof array !== 'undefined') {
    var coll = (array instanceof Collection) ? array : new Collection(array);
    return registry.set(name, coll);
  }
  if (!registry.has(name)) { registry.set(name, new Collection([])); } // lazy-create like Mongo
  return registry.get(name);
}


module.exports = {
  configure: settings.configure,
  Collection: Collection,
  Cursor: Cursor,
  collection: collection,
  db: registry._map,        // sugar: mm.db.orders === mm.collection('orders')
  _registry: registry,

  count: crud.count,
  copyTo: crud.copyTo,

  find: crud.find,
  findOne: crud.findOne,
  distinct: crud.distinct,

  deleteOne: crud.deleteOne,
  deleteMany: crud.deleteMany,
  remove: crud.remove,

  insertOne: crud.insertOne,
  insertMany: crud.insertMany,
  insert: crud.insert,

  updateOne: crud.updateOne,
  updateMany: crud.updateMany,
  replaceOne: crud.replaceOne,

  findOneAndUpdate: crud.findOneAndUpdate,
  findOneAndReplace: crud.findOneAndReplace,
  findOneAndDelete: crud.findOneAndDelete,

  _crud: crud,
  aggregate: aggregate,
};
