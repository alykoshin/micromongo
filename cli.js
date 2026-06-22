#!/usr/bin/env node

const _ = require('lodash');
const fs = require('fs');//.promises;
const argv = require('minimist')(process.argv.slice(2));

const mm = require('./');

const pkg = require('./package.json');

function help() {
  console.log([
    '',
    '  Package name:    ' + pkg.name,
    '  Package version: ' + pkg.version,
    '',
    '  Package description: ' + pkg.description,
    '',
    '  Example:',
    '    ' + pkg.name,
    '    node node_modules/' + pkg.name + '/cli.js',
    '',
  ].join('\n'));
}

function version() {
  console.log([
    '* version():',
    '* package.json version: ' + pkg.version,
    '* process.version: ' + process.version,
    ''
  ].join('\n'));
}

function getFromStdin() {
  return fs.readFileSync(0, "utf-8");
}

async function getJsonStr(fileSwitch, jsonSwitch, stdinEnabled) {
  let jsonStr = '';
  const filename = fileSwitch.map(s=>argv[s]).filter(s=>!!s)[0];
  //console.log('getJsonStr(): filename:', filename);
  if (filename) {
    jsonStr = await fs.readFileSync(filename);
    //console.log('getJsonStr(): jsonStr:', jsonStr);
  } else {
    //jsonStr = argv[jsonSwitch] || '';
    jsonStr = jsonSwitch.map(s=>argv[s]).filter(s=>!!s)[0];
    //console.log('getJsonStr(): jsonStr:', jsonStr);
    if (!jsonStr && stdinEnabled) {
      jsonStr = getFromStdin();
    }
  }
  return jsonStr || '';
}

async function getJson(f,j, stdinEnabled,defaultValue) {
  const jsonStr = (await getJsonStr(f,j, stdinEnabled));
  //console.log('getJson():', jsonStr);
  if (jsonStr || !defaultValue) {
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('ERROR parsing JSON:', jsonStr);
      throw e;
    }
  } else {
    return defaultValue;
  }
}

async function handleArgv() {
  //console.log('handleArgv:', argv);
  if (argv.h || argv.help) {
    help();
    process.exit(0);

  } else if (argv.v || argv.version) {
    version();
    process.exit(0);

  } else if (argv._[0]/* === 'find'*/) {

    // ./cli.js find '[{"a":"b"},{"a":"c"}]' '{"a":"b"}'
    // ./cli.js find --array '[{"a":"b"},{"a":"c"}]' '{"a":"b"}'
    // ./cli.js find --aj '[{"a":"b"},{"a":"c"}]' --qj '{"a":"b"}'
    // ./cli.js find --af '[{"a":"b"},{"a":"c"}]' --qj '{"a":"b"}'
    // ./cli.js find --array-json '[{"a":"b"},{"a":"c"}]' --qj '{"a":"b"}'
    // ./cli.js find --array-file '[{"a":"b"},{"a":"c"}]' --qj '{"a":"b"}'

    const array = await getJson(['af','array-file'],['aj','array-json'], true, []);
    const query = await getJson(['qf','query-file'],['qj','query-json'], false, {});
    const projection = await getJson(['pf','projection-file'],['pj','projection-json'], false, {});
    //console.log(array,query,projection);

    const fnName =  argv._[0];
    const fn = _.get(mm, fnName);
    if (typeof fn !== 'function') throw new Error(`${fnName} is not a function`);

    const result = fn(array, query,projection);
    console.log(result);

  } else {
    throw new Error('Invalid command');
  }
}


handleArgv();
