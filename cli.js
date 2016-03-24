#!/usr/bin/env node
'use strict';

var argv = require('minimist')(process.argv.slice(2));
var pkg = require('./package.json');
var micromongo = require('./');


function help() {
  console.log([
    '',
    '  Package name: ' + pkg.name,
    '',
    '  Package description: ' + pkg.description,
    '',
    '  Example:',
    '    node node_modules/' + pkg.name + '/cli.js',
    ''
  ].join('\n'));
}

function version() {
  console.log([
    '* version info:',
    '* package.json version: ' + pkg.version,
    '* process.version: ' + process.version,
    ''
  ].join('\n'));
}

if (argv.h || argv.help) {
  help();
  process.exit(0);
}

if (argv.v || argv.version) {
  version();
  process.exit(0);
}


var main = require('./');

main.exec(argv[0], function() {

});
