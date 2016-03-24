[![npm version](https://badge.fury.io/js/micromongo.svg)](http://badge.fury.io/js/micromongo)
[![Build Status](https://travis-ci.org/alykoshin/micromongo.svg)](https://travis-ci.org/alykoshin/micromongo)
[![Coverage Status](https://coveralls.io/repos/alykoshin/micromongo/badge.svg?branch=master&service=github)](https://coveralls.io/github/alykoshin/micromongo?branch=master)
[![Code Climate](https://codeclimate.com/github/alykoshin/micromongo/badges/gpa.svg)](https://codeclimate.com/github/alykoshin/micromongo)
[![Inch CI](https://inch-ci.org/github/alykoshin/micromongo.svg?branch=master)](https://inch-ci.org/github/alykoshin/micromongo)

[![Dependency Status](https://david-dm.org/alykoshin/micromongo/status.svg)](https://david-dm.org/alykoshin/micromongo#info=dependencies)
[![devDependency Status](https://david-dm.org/alykoshin/micromongo/dev-status.svg)](https://david-dm.org/alykoshin/micromongo#info=devDependencies)


# micromongo

Mongodb-like operations over arrays of objects.

Array of objects is a very common data structure in programming. 
If your application widely using this type of data, and you are familiar with Mongodb approach, you may consider this package to handle the arrays of objects.  

Please, be aware that this module is not intended to be used with relatively big arrays and not optimized for that tasks.
If you have big sets of data, I'd recommend to consider `minimongo`'s `Collection` or Mongodb itself


Currently only `find()` and `findOne()` are supported.
Not supported array elements, geolocation queries etc; for more info see compatibility matrix below.

```
var mm = require('../');
//var mm = require('micromongo');

var data = [
  { qty: 10, price: 10 },
  { qty: 10, price:  0 },
  { qty: 20, price: 10 },
  { qty: 20, price:  0 },
  { qty: 30, price: 10 },
  { qty: 30, price:  0 },
];
var query = { $or: [ { quantity: { $eq: 20 } }, { price: { $lt: 10 } } ] };
var projection = { qty :1 };

var res = mm.find(data, query, projection);

console.log(res);
```

Result:

```
// [ { qty: 10 }, { qty: 20 }, { qty: 30 } ]
```

You can find examples in `examples/` subdirectory.

For more examples please refer to tests in `tests/` subdirectory. 


If you have different needs regarding the functionality, please add a [feature request](https://github.com/alykoshin/micromongo/issues).


## Installation

```sh
npm install --save micromongo
```

## Usage


## Compatibility matrix

At the moment supports `find()` and `findOne()` methods.

`_id` in projection are ignored
 ! need to decide which behavior is better


Matrix below is based on Mongo doc 3.2

## Collection Methods

Method                  | Status 
------------------------|--------
aggregate()             | ?
bulkWrite()             | ?
count()                 | .
copyTo()                | ?
createIndex()           | NA
dataSize()              | NA
deleteOne()             | .
deleteMany()            | .
distinct()              | ?
drop()                  | NA
dropIndex()             | NA
dropIndexes()           | NA
ensureIndex()           | NA
explain()               | NA
**find()**              | **+**
findAndModify()         | ?
**findOne()**           | **+**
findOneAndDelete()      | ?
findOneAndReplace()     | ?
findOneAndUpdate()      | ?
getIndexes()            | NA
getShardDistribution()  | NA
getShardVersion()       | NA
group()                 | ?
insert()                | .
insertOne()             | .
insertMany()            | .
isCapped()              | NA
mapReduce()             | ?
reIndex()               | NA
replaceOne()            | ?
remove()                | ?
renameCollection()      | NA
save()                  | NA
stats()                 | NA
storageSize()           | NA
totalSize()             | NA
totalIndexSize()        | NA
update()                | .
updateOne()             | .
updateMany()            | .
validate()              | NA

NA - Not Applicable
?  - Not planned
.  - Not implemented


## Query and Projection Operators

### Comparison Operators

Operator       | Status 
---------------|--------
**$eq**        | **+**
**$ne**        | **+**
**$gt**        | **+**
**$gte**       | **+**
**$lt**        | **+**
**$lte**       | **+**
**$in**        | **+**
**$nin**       | **+**
  
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

Operator       | Status    
---------------|--------   
$mod           | .
$regex         | .
$text          | ?
$where         | .

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

Operator       | Status     
---------------|--------    
$all           | .
$elemMatch     | .
$size          | .
 
### Bitwise Query Operators

Operator       | Status 
---------------|--------
$bitsAllSet    | ?
$bitsAnySet    | ?
$bitsAllClear  | ?
$bitsAnyClear  | ?
 
### $comment
                         
Operator       | Status  
---------------|-------- 
$comment       | .

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
$ 	Acts as a placeholder to update the first element that matches the query condition in an update.
$addToSet 	Adds elements to an array only if they do not already exist in the set.
$pop 	Removes the first or last item of an array.
$pullAll 	Removes all matching values from an array.
$pull 	Removes all array elements that match a specified query.
$pushAll 	Deprecated. Adds several items to an array.
$push 	Adds an item to an array.

## Update Operator Modifiers
Name 	Description
$each 	Modifies the $push and $addToSet operators to append multiple items for array updates.
$slice 	Modifies the $push operator to limit the size of updated arrays.
$sort 	Modifies the $push operator to reorder documents stored in an array.
$position 	Modifies the $push operator to specify the position in the array to add elements.


## Bitwise Update Operator¶
Name 	Description
$bit 	Performs bitwise AND, OR, and XOR updates of integer values.

## Isolation Update Operator¶
Name 	Description
$isolated 	Modifies the behavior of a write operation to increase the isolation of the operation.

## Aggregation Pipeline Operators
### Pipeline Aggregation Stages
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
