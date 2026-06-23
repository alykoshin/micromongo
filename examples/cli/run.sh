#!/usr/bin/env bash
#
# Examples for the micromongo CLI (mongosh-flavored, in-memory).
#
#   micromongo                          interactive shell (bare, like `mongosh`)
#   micromongo --eval "<expr>"          evaluate one line (repeatable; last result prints)
#   micromongo --file script.js         run a script file
#   --load file.json:name               load a JSON array as a collection (no server to connect to)
#
# Run from this directory: bash run.sh

CLI="../../cli.js"
LOAD="--load ./orders.json:orders"

echo "=== --eval one-shot ==="

echo "* find + sort + limit"
$CLI --eval "db.orders.find({status:'A'}).sort({qty:-1}).limit(2).toArray()" $LOAD

echo "* createIndex + explain (the chosen plan: IXSCAN vs COLLSCAN)"
$CLI --eval "db.orders.createIndex({status:1})" \
     --eval "db.orders.find({status:'A'}).explain()" $LOAD

echo "* range query served by an ordered index"
$CLI --eval "db.orders.createIndex({qty:1})" \
     --eval "db.orders.find({qty:{\$gte:50}}).explain()" $LOAD

echo "* aggregate: group by status"
$CLI --eval 'db.orders.aggregate([{$group:{_id:"$status",n:{$sum:1},total:{$sum:"$qty"}}}])' $LOAD

echo "* show collections (--json output)"
$CLI --json --eval 'show collections' $LOAD


echo ""
echo "=== --file script ==="
$CLI --file ./report.js $LOAD


echo ""
echo "=== interactive shell (piped here; normally just run: micromongo $LOAD) ==="
printf 'show collections\ndb.orders.createIndex({status:1})\ndb.orders.find({status:"A"}).explain()\nexit\n' \
  | $CLI --quiet $LOAD
