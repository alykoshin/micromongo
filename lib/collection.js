/**
 * Collection — a thin, stateful wrapper that owns an array of documents and
 * exposes the functional API as methods, MongoDB-driver style:
 *
 *     var users = new Collection([ ... ]);
 *     users.insertOne({ ... });
 *     users.find({ age: { $gte: 18 } }, { name: 1 });
 *
 * It is pure data encapsulation: every method forwards to the corresponding
 * `lib/crud` / `lib/aggregate` function, passing the owned array. The mutation
 * contract is preserved — reads (find/findOne/count/aggregate) return deep
 * copies and never touch the data; writes (insert/delete/remove families)
 * mutate the owned array in place and return the usual report object.
 *
 * There are deliberately NO micromongo-specific options here. Real MongoDB
 * collection-level options (collation, readConcern, writeConcern, …) are either
 * N/A for an in-memory array or not yet implemented, so the constructor takes
 * only the data. Global behavior is configured via `mm.configure()`. The second
 * `options` argument is reserved for a future *real* Mongo option and is stored
 * but otherwise unused today.
 */

'use strict';

var crud = require('./crud/');
var aggregate = require('./aggregate/');


/**
 * @param {Array}  [array]   - the documents this collection owns (default []).
 * @param {Object} [options] - reserved for future MongoDB collection options;
 *                             stored as `_options`, not interpreted yet.
 * @constructor
 */
function Collection(array, options) {
  if (typeof array === 'undefined') { array = []; }
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  this._data = array;
  this._options = options || {};
}

// --- reads (pure; return deep copies) ---

Collection.prototype.count = function (query) {
  return crud.count(this._data, query);
};

Collection.prototype.find = function (query, projection) {
  return crud.find(this._data, query, projection);
};

Collection.prototype.findOne = function (query, projection) {
  return crud.findOne(this._data, query, projection);
};

Collection.prototype.aggregate = function (stages) {
  return aggregate(this._data, stages);
};

// --- writes (mutate the owned array in place; return a report object) ---

Collection.prototype.insertOne = function (doc, options) {
  return crud.insertOne(this._data, doc, options);
};

Collection.prototype.insertMany = function (docs, options) {
  return crud.insertMany(this._data, docs, options);
};

Collection.prototype.insert = function (docOrDocs, options) {
  return crud.insert(this._data, docOrDocs, options);
};

Collection.prototype.deleteOne = function (query) {
  return crud.deleteOne(this._data, query);
};

Collection.prototype.deleteMany = function (query) {
  return crud.deleteMany(this._data, query);
};

Collection.prototype.remove = function (query, options) {
  return crud.remove(this._data, query, options);
};

// --- access to the underlying data ---

/**
 * Return the owned array (the live reference, not a copy) — mirrors holding the
 * raw array in the functional API. Mutating it bypasses the collection, so treat
 * it as read access.
 * @returns {Array}
 */
Collection.prototype.toArray = function () {
  return this._data;
};


module.exports = Collection;
