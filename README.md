[![npm version](https://badge.fury.io/js/micromongo.svg)](http://badge.fury.io/js/micromongo)
[![Build Status](https://travis-ci.org/alykoshin/micromongo.svg)](https://travis-ci.org/alykoshin/micromongo)
[![Coverage Status](https://coveralls.io/repos/alykoshin/micromongo/badge.svg?branch=master&service=github)](https://coveralls.io/github/alykoshin/micromongo?branch=master)
[![Code Climate](https://codeclimate.com/github/alykoshin/micromongo/badges/gpa.svg)](https://codeclimate.com/github/alykoshin/micromongo)
[![Inch CI](https://inch-ci.org/github/alykoshin/micromongo.svg?branch=master)](https://inch-ci.org/github/alykoshin/micromongo)

[![Dependency Status](https://david-dm.org/alykoshin/micromongo/status.svg)](https://david-dm.org/alykoshin/micromongo#info=dependencies)
[![devDependency Status](https://david-dm.org/alykoshin/micromongo/dev-status.svg)](https://david-dm.org/alykoshin/micromongo#info=devDependencies)


# micromongo

Mongodb-like queries over standard arrays of objects.

Array of objects (documents in Mongodb's terminology) is a very common data structure in programming. 
If your application widely using this type of data, if you are looking for something relatively lightweight 
and you are familiar with Mongodb syntax, you may consider this package to handle the arrays of objects.  

By default a query is a linear scan over the array, which is plenty fast for typical in-memory data.
For larger collections, wrap the data in a `Collection` and add an index (`createIndex(field)`) to
turn single-field equality lookups into O(1) — see the [performance](#performance) section for the
measured scan-vs-index numbers. The functional `mm.find(array, …)` API stays a scan (it can't own the
array to keep an index valid); the `Collection` API is the path to scale.


Currently following methods are supported:
- [`count()`](#count), 
- [`find()`](#find),
- [`findOne()`](#findone)
- [`deleteOne()`](#deleteone)
- [`deleteMany()`](#deletemany)
- [`remove()`](#remove)
- [`insert()`](#insert)
- [`insertOne()`](#insertone)
- [`insertMany()`](#insertmany)
- [`aggregate()`](#aggregate) (stages `skip`, `limit`, `sort`, `unwind`, partially `project`)


Not supported: indexes, geolocation, bitwise operators etc; also not supported cursor methods `skip()`, `limit()`, `sort()`.  
Limited support for querying array elements; not supported /pattern/ syntax (without $regexp) 

For more info see [compatibility matrix](#compatibility-matrix) below.

Tests contains over 200 different test cases based on module's logic and examples from Mongodb docs.

Supported `node` version >= 0.11.


## Installation

```sh
npm install --save micromongo
```


# Usage

## `count()`

Method `count()` return number of documents matching query.

Syntax:

```js
res = mm.count(array, query);
```

`array` - array of objects

`query` - query object

Following example returns number of elements with `a >= 2` (i.e. `2`):

```js
var mm = require('micromongo');
res = mm.count([ { a: 1 }, { a: 2 }, { a: 3 }, ], { a: { $gte: 2 } });

// res = 2
```

If `query` is `undefined` or empty object (`{}`), method returns total count of elements in array:

```js
var mm = require('micromongo');
res = mm.count([ { a: 1 }, { a: 2 }, { a: 3 }, ], {});

// res = 3
```


## `find()`

Method `find()` returns deep copy (with some type limitations) of array's documents matching query with fields matching projection.

If documents in array contains `_id` field, projection follows standard Mongo agreement to include it in output document by default.


```js
var mm = require('micromongo');

inventory = [
  { qty: 10, carrier: { fee: 3 }, price: 3 },
  { qty: 20, carrier: { fee: 2 }, price: 2 },
  { qty: 30, carrier: { fee: 1 }, price: 1 },
];

var query = { qty: { $gt: 20 } };

var res = mm.find(inventory, query);

// { qty: 30, carrier: { fee: 1 }, price: 1 },
```


## `findOne()`

Method `findOne()` returns deep copy (with some type limitations) of first array's documents matching query with fields matching projection.

If documents in array contains `_id` field, projection follows standard Mongo agreement to include it in output document by default.

```js
doc = mm.findOne(array, query, projection);
```


## `deleteOne()`

Method `deleteOne()` removes from array its first document matching query.

Returns document containing
- `deletedCount` containing the number of deleted documents

```js
var res = mm.deleteOne(array, query);

// { deletedCount: 1 }  
```


## `deleteMany()`

Method `deleteMany()` removes from array all its documents matching query.

```js
var res = mm.deleteMany(array, query);

// { deletedCount: 1 }  
```

Returns document containing
- `deletedCount` containing the number of deleted documents


## `remove()`

Method `remove()` removes from array its first document matching query or all documents matching query.

```js
var res = mm.remove(array, query);

// { nRemoved: 1 }  

var res = mm.remove(array, query, {});

// { nRemoved: 1 }  
```

Parameters:
- [`options`] - may be boolean or document containing boolean property `justOne`. Optional, default: `false`. Determines, all matched documents to be removed or only first of them.

Returns document containing
- `nRemoved` containing the number of deleted documents


Parameters:
- [`options`] - may be boolean or document containing boolean property `justOne`. Optional, default: `false`. Determines, all matched documents to be removed or only first of them.

Returns document containing
- `nRemoved` containing the number of deleted documents


## `insert()`

While Mongo creates new Collection if it does not exists, for `micromongo` array must exists.

```js
var res = mm.insert(array, sourceDocOrArray, options);

// { nInserted: 1 }  
```

- `options.ordered` - `boolean` - not supported


## `insertOne()`

While Mongo creates new Collection if it does not exists, for `micromongo` array must exists.

```js
var res = mm.insertOne(array, sourceDoc, options);

// { nInserted: 1 }  
```


## `insertMany()`

While Mongo creates new Collection if it does not exists, for `micromongo` array must exists.

```js
var res = mm.insert(array, sourceArray, options);

// { nInserted: 1 }  
```

- `options.ordered` - `boolean` - not supported


## `aggregate()`

```js
var res = mm.aggregate(array, stages);
```

`stages` - array of aggregation pipeline stages.

Currently supported aggregation pipeline stages:

- `$limit`  - `mm.aggregate([ { $limit: 5 } ])`

- `$skip`   - `mm.aggregate([ { $skip: 5 } ])`       

- `$sort`   - `mm.aggregate([ { $sort: { a: 1 }, { 'a.b': -1 } } ])`

Array and objects in `$sort` not currently supported. 

- `$unwind` - `mm.aggregate([ { $unwind: '$customer.items' } ])` or 

```js
mm.aggregate([ { $unwind: { 
    path: '$customer.items', 
    includeArrayIndex: 'idx',
    preserveNullAndEmptyArrays: true
  } 
])` 
```

# Examples 

## count()

```js
//var mm = require('../');
var mm = require('micromongo');

var array, query, res;

array = [
  { a: 1 },
  { a: 2 },
  { a: 3 },
];

query = { a: { $gte: 2 } };

res = mm.count(array, query);
console.log(res);

// 2

query = {};

res = mm.count(array, query);
console.log(res);

// 3
```


## Example find()

```js
//var mm = require('../');
var mm = require('micromongo');

var array, query, projection, res;

array = [
  { qty: 10, price: 10 },
  { qty: 10, price:  0 },
  { qty: 20, price: 10 },
  { qty: 20, price:  0 },
  { qty: 30, price: 10 },
  { qty: 30, price:  0 },
];

query = { $or: [ { quantity: { $eq: 20 } }, { price: { $lt: 10 } } ] };

projection = { qty: 1 };

res = mm.find(array, query, projection);
console.log(res);

// [ { qty: 10 }, { qty: 20 }, { qty: 30 } ]
```

You can find these examples in `examples/` subdirectory.
To run all the examples at once you may start `node examples\index.js`.

For more examples please also have a look on tests in `tests/` subdirectory. 


If you have different needs regarding the functionality, please add a [feature request](https://github.com/alykoshin/micromongo/issues).



# CLI

`micromongo` ships a command-line tool ([`cli.js`](cli.js)) whose invocation mirrors
[`mongosh`](https://www.mongodb.com/docs/mongodb-shell/reference/options/), minus the parts that
imply a server (micromongo is in-memory). Since there's no server to connect to, instead of a
connection string you load local JSON arrays as collections with `--load file.json:name`.

### Interactive shell (bare invocation, like `mongosh`)

```sh
micromongo --load orders.json:orders
```

Drops you into a REPL where `db.<collection>` resolves a `Collection`, with tab-completion of
collection/method names:

```
micromongo> show collections
[ { name: 'orders', count: 5 } ]
micromongo> db.orders.find({ status: 'A' }).sort({ qty: -1 }).limit(2).toArray()
[ { _id: 3, status: 'A', qty: 90 }, … ]
micromongo> db.orders.createIndex({ status: 1 })
{ collection: 5 docs, indexes: [status] }
micromongo> db.orders.find({ status: 'A' }).explain()
{ stage: 'IXSCAN', indexed: true, exact: true, plan: { index: 'status_1', op: 'eq', usedHash: true }, … }
micromongo> db.orders.aggregate([ { $group: { _id: "$status", n: { $sum: 1 } } } ])
```

Shell commands: `show collections` / `show dbs`, `use <name>` (single namespace — cosmetic),
`load("file.json","name")`, `save("name","file.json")`, `help`, `exit`. Anything else runs as
JavaScript against the live API (`mm.configure(...)`, `mm.registerOperator(...)`, … all work).

### One-shot `--eval` (like `mongosh --eval`)

Evaluate one or more expressions; repeatable, and only the **last** result prints (mongosh's rule):

```sh
micromongo --eval "db.orders.find({status:'A'}).toArray()" --load orders.json:orders
micromongo --eval "db.orders.createIndex({status:1})" \
           --eval "db.orders.find({status:'A'}).explain()" --load orders.json:orders
micromongo --json --eval "db.orders.find({status:'B'}).toArray()" --load orders.json:orders
```

### Run a script file (`--file` / `-f`, like `mongosh --file`)

```sh
micromongo --file report.js --load orders.json:orders
```

The script runs in the same sandbox (`db`, `mm`, `print()` in scope). Add `--shell` to drop into the
interactive shell after `--eval`/`--file`; `--quiet` suppresses the startup banner.

See [`examples/cli/run.sh`](examples/cli/run.sh) and [`examples/cli/report.js`](examples/cli/report.js)
for runnable examples.



# Testing

For unit tests run:

```sh
npm run _test
```


# Performance

A bare query (the functional `mm.*` API, or a `Collection` with no index) is a linear scan — O(n) in
the array length. That's fast for typical in-memory sizes; the numbers below show where it stands, and
the [indexed-lookups](#indexed-lookups-collection-vs-linear-scan) section shows how a `Collection`
index collapses single-equality lookups to O(1) for larger data.

Test system: 
- Intel® Core™ i7-3520M (2.90 GHz, 4MB L3, 1600MHz FSB)
- 16GB 1600 MHz DDR3

Tests showed following results for operations `count`, `find`, `aggregate` `$sort` over arrays of `1000`, `10000`, `100000` elements:

```
  #performance
Processed 1000 elements - Elapsed: 26 ms
    ✓ # count 1000 elements
Processed 10000 elements - Elapsed: 261 ms
    ✓ #count 10000 elements (262ms)
    - # count 100000 elements
Processed 1000 elements - Elapsed: 26 ms
    ✓ # find 1000 elements
Processed 10000 elements - Elapsed: 246 ms
    ✓ # find 10000 elements (247ms)
    - # find 100000 elements
Processed 1000 elements - Elapsed: 15 ms
    ✓ # sort 1000 elements
Processed 10000 elements - Elapsed: 102 ms
    ✓ # sort 10000 elements (102ms)
    - # sort 100000 elements
Processed 1000 elements - Elapsed: 481 ms
    ✓ # node version >= v5.3.0 - find $where 1000 elements (481ms)
Processed 5000 elements - Elapsed: 2997 ms
    ✓ # node version >= v5.3.0 - find $where 5000 elements (2997ms)
 ```

For `node` version < 5.3.0 `$where` is significantly slower due to imementation of `vm`.

These numbers are produced by [`test/performance.js`](test/performance.js) — the `count`/`find`/
`$sort`/`$where` timing cases above. The `10000`/`100000`-element rows are `it.skip`-ped by default
(they're slow); un-skip them in that file to reproduce the larger sizes. Run them and read the
`#performance` console output via `npm run _test` (the timings print to stdout; the cases assert only
loosely, since wall-clock assertions are flaky on shared machines).

## Indexed lookups (Collection) vs. linear scan

The functional API (`mm.find(array, …)`) is **always** a linear scan — it can't be otherwise, because
the caller owns the array and mutates it directly, so micromongo can't keep an index valid (see the
[Indexes section in docs/compatibility.md](docs/compatibility.md)). A [`Collection`](docs/architecture.md),
which *owns* its data, can opt into an **equality (hash) index** that turns a single plain-equality
query (`{ field: value }` / `{ field: { $eq: value } }`) into an O(1) lookup instead of an O(n) scan:

```js
var c = new mm.Collection(bigArray);
c.createIndex('sku');             // build a Map<value, docs[]> once
c.findOne({ sku: 'sku-42' });     // served from the index, no scan
c.find({ sku: { $gt: 'x' } });    // NOT a plain-equality query -> falls back to a scan
```

Measured by [`test/performance-index.js`](test/performance-index.js) — single-equality `findOne`
lookups (spread evenly across the whole array, so the average scan depth grows with `n`) against an
index-less `Collection` (linear scan) vs. one with `createIndex('sku')`. Timing uses
`process.hrtime.bigint()` (nanosecond resolution) and reports the best of several warmed-up runs to
shed GC/scheduler noise. Run it with `node ./node_modules/mocha/bin/_mocha test/performance-index.js`;
it prints this copy-paste block (numbers from one run on the test system — they vary slightly):

```
  index-vs-scan: best of 5 runs of evenly-spread single-equality findOne() lookups (after warmup)

  Collection size scan (us/lookup)  indexed (us/lookup)  speedup
  ---------------------------------------------------------------
  1 000           101.82            0.46                 222x
  10 000          1075.79           0.22                 4788x
  100 000         10011.61          0.26                 38373x
```

This is the O(1)-vs-O(n) story in numbers: the scan cost grows ~**10× for each 10×** more data
(~100 µs → ~1 ms → ~10 ms per lookup), while the indexed lookup stays ~0.25 µs **regardless of
collection size** (a single hash hit). So the speedup itself scales with the data — from ~200× at
1 000 docs to ~40 000× at 100 000. The bigger the collection, the more the index is worth (on the one
query shape it covers).

Caveats (current): the index accelerates **only** a single plain-equality predicate on the indexed
field — range/`$or`/`$regex`/multi-field queries and aggregation all transparently fall back to the
scan, returning identical results. (Range + sort acceleration is the next step — see the roadmap in
[docs/implementation-plan.md](docs/implementation-plan.md).) Maintenance is **rebuild-after-write**
(provably consistent; O(n) per write, so best for read-heavy use), and the `Collection` must be the
sole writer (mutating `toArray()` directly bypasses it; `reindex()` recovers). Indexes are opt-in and
never change *what* a query returns — only how fast.
Reproduce with `node ./node_modules/mocha/bin/_mocha test/performance-index.js`.



# Compatibility matrix

At the moment supports only `find()` and `findOne()` operations.

If documents in array contains `_id` field, projection follows standard Mongo agreement to include it in output document by default.


Matrix below is based on Mongodb 3.2 documentation.

## Collection Methods

Method                  | Status |
------------------------|--------|--------------------------
aggregate()             | **+**  | see [Aggregation Pipeline Operators](#aggregation-pipeline-operators)
bulkWrite()             | ?      |
**count()**             | **+**  |
**copyTo()**            | **+**  |
createIndex()           | NA     |
dataSize()              | NA     |
**deleteOne()**         | **+**  |
**deleteMany()**        | **+**  |
distinct()              | ?      |
drop()                  | NA     |
dropIndex()             | NA     |
dropIndexes()           | NA     |
ensureIndex()           | NA     |
explain()               | NA     |
**find()**              | **+**  |
findAndModify()         | ?      |
**findOne()**           | **+**  |
findOneAndDelete()      | ?      |
findOneAndReplace()     | ?      |
findOneAndUpdate()      | ?      |
getIndexes()            | NA     |
getShardDistribution()  | NA     |
getShardVersion()       | NA     |
group()                 | ?      |
**insert()**            | **+**  |
**insertOne()**         | **+**  |
**insertMany()**        | **+**  |
isCapped()              | NA     |
mapReduce()             | ?      |
reIndex()               | NA     |
replaceOne()            | ?      |
**remove()**            | **+**  |
renameCollection()      | NA     |
save()                  | NA     |
stats()                 | NA     |
storageSize()           | NA     |
totalSize()             | NA     |
totalIndexSize()        | NA     |
update()                | .      |
updateOne()             | .      |
updateMany()            | .      |
validate()              | NA     |

+  - Supported

NA - Not Applicable

?  - Not planned

.  - Not implemented


## Query and Projection Operators


### Comparison Operators

Operator       | Status | Comment
---------------|--------|-----------------------
**$eq**        | **+**  |
**$ne**        | **+**  |
**$gt**        | **+**  |
**$gte**       | **+**  |
**$lt**        | **+**  |
**$lte**       | **+**  |
**$in**        | **+**  |
**$nin**       | **+**  | arrays not supported
  
  
### Logical Operators
               
Operator       | Status 
---------------|--------
**$and**       | **+**    
**$or**        | **+**    
**$not**       | **+**    
**$nor**       | **+**    


### Element Query Operators

Operator       | Status    
---------------|--------   
**$exists**    | **+**
**$type**      | **+**

 
### Evaluation query operators

Operator       | Status | Comment  
---------------|--------|----------------------------------   
**$mod**       | **+**  |  
**$regex**     | **+**  | Not supported `o`, `x` options
$text          | ?      |  
**$where**     | **+**  | Timeout hardcoded to 1000 ms  


### Geospatial Query Operators

Operator       | Status  
---------------|-------- 
$geoWithin     | ?
$geoIntersects | ?
$near          | ?
$nearSphere    | ?
$geometry      | ?
$minDistance   | ?
$maxDistance   | ?
$center        | ?
$centerSphere: | ?
$box           | ?
$polygon       | ?
$uniqueDocs    | ?
 
 
### Query Operator Array 

Operator       | Status | Comment   
---------------|--------|----------------    
**$all**       | **+**  | Not supported: (1) nested arrays, (2) use with `$elemMatch`, 
**$elemMatch** | **+**  | 
**$size**      | **+**  |
 
 
### Bitwise Query Operators

Operator       | Status 
---------------|--------
$bitsAllSet    | ?
$bitsAnySet    | ?
$bitsAllClear  | ?
$bitsAnyClear  | ?
 
 
### $comment
                         
Operator       | Status | Comment 
---------------|--------|------------------- 
**$comment**   | **+**  | Logs to console


### Projection operators

Operator       | Status 
---------------|--------
$              | .
$all           | .
$elemMatch     | .
$size          | .


## Update Operators

### Field Update Operators
$inc 
$mul 
$rename 
$setOnInsert
$set
$unset 
$min 
$max 
$currentDate

## Update Operators
$ 
$addToSet 
$pop
$pullAll 
$pull
$pushAll 
$push 

## Update Operator Modifiers
$each 
$slice
$sort 
$position 


## Bitwise Update Operator¶
$bit 

## Isolation Update Operator¶
$isolated 

## Aggregation Pipeline Operators

### Pipeline Aggregation Stages

Operator       | Status 
---------------|--------
$project       | **+**
$match         | **+**
$redact        | .
**$limit**     | **+**
**$skip**      | **+**
**$unwind**    | **+**         s
$group         | .
$sample        | .
**$sort**      | **+**
$geoNear       | .
$lookup        | .
$out           | .
$indexStats    | NA

### Boolean Aggregation Operators
### Set Operators (Aggregation)
### Comparison Aggregation Operators
### Arithmetic Aggregation Operators
### String Aggregation Operators
### Text Search Aggregation Operators
### Array Aggregation Operators
### Aggregation Variable Operators
### Aggregation Literal Operators
### Date Aggregation Operators
### Conditional Aggregation Operators
### Group Accumulator Operators


## Credits
[Alexander](https://github.com/alykoshin/)


# Links to package pages:

[github.com](https://github.com/alykoshin/micromongo) &nbsp; [npmjs.com](https://www.npmjs.com/package/micromongo) &nbsp; [travis-ci.org](https://travis-ci.org/alykoshin/micromongo) &nbsp; [coveralls.io](https://coveralls.io/github/alykoshin/micromongo) &nbsp; [inch-ci.org](https://inch-ci.org/github/alykoshin/micromongo)


## License

MIT
