#!/usr/bin/env node

/**
 * micromongo CLI — mongosh-flavored, over an in-memory db/Collection model.
 *
 * Invocation mirrors mongosh (https://www.mongodb.com/docs/mongodb-shell/reference/options/),
 * minus anything that implies a server connection (micromongo is in-memory):
 *
 *   micromongo                              interactive shell (like bare `mongosh`)
 *   micromongo --eval "<expr>"              evaluate one line and print the result
 *   micromongo --eval a --eval b            repeatable; only the LAST result prints (mongosh rule)
 *   micromongo --file script.js  (-f)       run a script file (like `mongosh --file`)
 *   micromongo --eval "…" --shell           run --eval/--file, then drop into the shell
 *
 *   --load file.json:name                   micromongo-specific: there is no server to connect
 *                                           to, so instead of a connection string you load a
 *                                           local JSON array as a collection (repeatable)
 *   --quiet                                 suppress the startup banner (default for non-TTY)
 *   --json                                  print results as JSON instead of inspect-formatted
 *   -h/--help   --version
 *
 * The shell/eval/script all share the evaluator in lib/repl.js.
 */

'use strict';

const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2), {
  boolean: [ 'quiet', 'shell', 'json', 'help', 'h', 'version', 'nodb' ],
  alias: { f: 'file', h: 'help', e: 'eval' },
});

const repl = require('./repl');
const pkg = require('../package.json');


function help(): void {
  console.log([
    '',
    '  ' + pkg.name + ' v' + pkg.version + ' — ' + pkg.description,
    '',
    '  Usage (mongosh-flavored, in-memory):',
    '    micromongo                          start the interactive shell',
    '    micromongo --eval "<expr>"          evaluate one line (repeatable; last result prints)',
    '    micromongo --file script.js   (-f)  run a script file',
    '    micromongo --eval "<expr>" --shell  run, then enter the shell',
    '',
    '  Loading data (no server → load local JSON instead of a connection string):',
    '    --load file.json:name               register a JSON array as collection <name> (repeatable)',
    '',
    '  Options:  --quiet   --json   -h/--help   --version',
    '',
    '  Examples:',
    '    micromongo --load orders.json:orders',
    '    micromongo --eval "db.orders.find({status:\'A\'}).toArray()" --load orders.json:orders',
    '    micromongo --file report.js --load orders.json:orders',
    '',
  ].join('\n'));
}


/** Apply `--load file.json:name` flags (one or many) to the registry. */
function applyLoads(ctx: Record<string, any>): void {
  let loads = argv.load;
  if (typeof loads === 'undefined') { return; }
  if (!Array.isArray(loads)) { loads = [ loads ]; }
  loads.forEach(function (spec: string) {
    const idx = String(spec).lastIndexOf(':');
    if (idx < 0) { throw new Error('--load expects file.json:name, got: ' + spec); }
    repl.loadFile(ctx, String(spec).slice(0, idx), String(spec).slice(idx + 1));
  });
}

function printResult(value: any): void { // value: a heterogeneous eval/script result
  if (argv.json) {
    if (typeof value !== 'undefined') { console.log(JSON.stringify(value, null, 2)); }
    return;
  }
  const out = repl.formatResult(value);
  if (typeof out !== 'undefined') { console.log(out); }
}


function main(): void {
  if (argv.help) { help(); return; }
  if (argv.version) { console.log(pkg.name + ' ' + pkg.version + ' (node ' + process.version + ')'); return; }

  const ctx = repl.createContext();
  applyLoads(ctx);

  // Collect --eval expressions (repeatable) and a --file, mongosh-style.
  let evals = argv.eval;
  if (typeof evals !== 'undefined' && !Array.isArray(evals)) { evals = [ evals ]; }
  const file = argv.file;

  const nonInteractive = (evals && evals.length) || file;

  if (nonInteractive) {
    let last;
    if (evals) { evals.forEach(function (expr: string) { last = repl.evalLine(ctx, String(expr)); }); }
    if (file) { last = repl.runScript(ctx, file); }
    if (!argv.shell) { printResult(last); return; } // mongosh: only the last result prints
  }

  // Interactive shell (bare invocation, or after --eval/--file with --shell).
  repl.startShell({ context: ctx, quiet: argv.quiet });
}

// Guard: minimist parses a leftover positional? In mongosh that's a connection
// string; we have no server, so reject it with a hint toward --load/--file.
if (argv._.length) {
  console.error('micromongo: unexpected argument "' + argv._[0] + '".');
  console.error('There is no server to connect to — use --load file.json:name for data, --file for a script, or --eval. See --help.');
  process.exit(1);
} else {
  main();
}
