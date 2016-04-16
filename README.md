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

Please, be aware that this module is working on unsorted arrays and does not uses indexes, so it is not intended to be used with relatively big arrays (thousands of elements) and not purposed for that tasks (see [performance](#performance) section).
If you have big sets of data, I'd recommend to consider `minimongo`'s `Collection` or Mongodb itself.


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

```
res = mm.count(array, query);
```

`array` - array of objects

`query` - query object

Following example returns number of elements with `a >= 2` (i.e. `2`):

```
var mm = require('micromongo');
res = mm.count([ { a: 1 }, { a: 2 }, { a: 3 }, ], { a: { $gte: 2 } });

// res = 2
```

If `query` is `undefined` or empty object (`{}`), method returns total count of elements in array:

```
var mm = require('micromongo');
res = mm.count([ { a: 1 }, { a: 2 }, { a: 3 }, ], {});

// res = 3
```


## `find()`

Method `find()` returns deep copy (with some type limitations) of array's documents matching query with fields matching projection.

If documents in array contains `_id` field, projection follows standard Mongo agreement to include it in output document by default.


```
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

```
doc = mm.findOne(array, query, projection);
```


## `deleteOne()`

Method `deleteOne()` removes from array its first document matching query.

Returns document containing
- `deletedCount` containing the number of deleted documents

```
var res = mm.deleteOne(array, query);

// { deletedCount: 1 }  
```


## `deleteMany()`

Method `deleteMany()` removes from array all its documents matching query.

```
var res = mm.deleteMany(array, query);

// { deletedCount: 1 }  
```

Returns document containing
- `deletedCount` containing the number of deleted documents


## `remove()`

Method `remove()` removes from array its first document matching query or all documents matching query.

```
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

```
var res = mm.insert(array, sourceDocOrArray, options);

// { nInserted: 1 }  
```

- `options.ordered` - `boolean` - not supported


## `insertOne()`

While Mongo creates new Collection if it does not exists, for `micromongo` array must exists.

```
var res = mm.insertOne(array, sourceDoc, options);

// { nInserted: 1 }  
```


## `insertMany()`

While Mongo creates new Collection if it does not exists, for `micromongo` array must exists.

```
var res = mm.insert(array, sourceArray, options);

// { nInserted: 1 }  
```

- `options.ordered` - `boolean` - not supported


## `aggregate()`

```
var res = mm.aggregate(array, stages);
```

`stages` - array of aggregation pipeline stages.

Currently supported aggregation pipeline stages:

- `$limit`  - `mm.aggregate([ { $limit: 5 } ])`

- `$skip`   - `mm.aggregate([ { $skip: 5 } ])`       

- `$sort`   - `mm.aggregate([ { $sort: { a: 1 }, { 'a.b': -1 } } ])`

Array and objects in `$sort` not currently supported. 

- `$unwind` - `mm.aggregate([ { $unwind: '$customer.items' } ])` or 

```
mm.aggregate([ { $unwind: { 
    path: '$customer.items', 
    includeArrayIndex: 'idx',
    preserveNullAndEmptyArrays: true
  } 
])` 
```

# Examples 

## count()

```
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

```
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



# Testing

For unit tests run:

```
npm run _test
```


# Performance

As it was mentioned, `micromongo` runs on unsorted unindexed data, so it can't show good performance on big arrays.

Test system: 
- Intel® Core™ i7-3520M (2.90 GHz, 4MB L3, 1600MHz FSB)
- 16GB 1600 MHz DDR3

Tests showed following results for operations `count`, `find`, `aggregate` `$sort` over arrays of `1000`, `10000`, `100000` elements:

```
  #performance
Processed 1000 elements - Elapsed: 17 ms
    ✓ #count 1000 elements
Processed 10000 elements - Elapsed: 132 ms
    ✓ #count 10000 elements (133ms)
Processed 100000 elements - Elapsed: 1264 ms
    ✓ #count 100000 elements (1266ms)
Processed 1000 elements - Elapsed: 17 ms
    ✓ #find 1000 elements
Processed 10000 elements - Elapsed: 130 ms
    ✓ #find 10000 elements (130ms)
Processed 100000 elements - Elapsed: 1316 ms
    ✓ #find 100000 elements (1318ms)
Processed 1000 elements - Elapsed: 13 ms
    ✓ #sort 1000 elements
Processed 10000 elements - Elapsed: 106 ms
    ✓ #sort 10000 elements (106ms)
Processed 100000 elements - Elapsed: 1189 ms
 ```

You may have a look on the data used for the tests in `tests/performance.js`, and running tests by yourself by `npm run _test` and checking the console log for `performance` output.



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
**$regex**     | **+**  | (not supported `o`, `x` options)
$text          | ?      |  
**$where**     | **+**  |  


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
**$all**       | **+**  | Not supported nested arrays, use with $elemMatch, 
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
$project       | .
$match         | .
$redact        | .
**$limit**     | **+**
**$skip**      | **+**
**$unwind**    | **+**
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
