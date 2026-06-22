#!/usr/bin/env bash

echo "* Data from command line arguments"

../../cli.js find --array-json '[{"a":"b"},{"a":"c"}]' --qj '{"a":"b"}'

echo "* Data from files"

../../cli.js find --array-file ./array.json --qf ./query.json

echo "* Array from stdin, stdout to file"

rm ../temp/result.json
../../cli.js find --qf ./query.json < ./array.json > ../temp/result.json
cat ../temp/result.json


echo "* _crud._match true"

../../cli.js --array-json '{"a":"b"}' _crud._match --qj '{"a":"b"}'

echo "* _crud._match false"

../../cli.js --array-json '{"a":"b"}' _crud._match --qj '{"a":"c"}'
