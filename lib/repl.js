/**
 * micromongo shell — a small mongosh-flavored evaluator over the public API.
 *
 * Two entry points use the SAME evaluator:
 *   - startShell()  : an interactive REPL (cli.js `shell`)
 *   - evalLine(ctx, line) : evaluate one line (cli.js `eval`, and the REPL)
 *
 * The "mini-language" is a thin layer over JavaScript:
 *   - Shell commands are intercepted first: `show collections|dbs`, `use <name>`,
 *     `help`, `exit`/`quit`.
 *   - Everything else is evaluated as JS in a sandbox where `db`, `mm`, `ObjectId`,
 *     and the helpers are bound — so mongosh-style relaxed argument syntax
 *     (`db.orders.find({ status: 'A' })`, unquoted keys, single quotes) works
 *     because it is already valid JS. A bare `Cursor` result is auto-materialized
 *     to an array for display (mongosh shows the batch, not the cursor object).
 *
 * `db` is micromongo's collection registry (`mm.db`), so `db.orders` lazily
 * resolves a Collection — there is a single namespace (no real multiple DBs), so
 * `use` is accepted but only records the current name for the prompt.
 */

'use strict';

var vm = require('vm');
var util = require('util');
var fs = require('fs');

var mm = require('../');
var Cursor = require('./cursor');
var ObjectId = require('./utils').ObjectId;


/**
 * Build a shell context: the sandbox bound into evaluated lines + shell state.
 * @returns {Object} ctx
 */
function createContext() {
  var ctx = {
    dbName: 'micromongo',
    sandbox: null,
  };

  var sandbox = {
    db: mm.db,                 // registry map → db.<name> lazily resolves a Collection
    mm: mm,
    ObjectId: ObjectId,
    print: function () { console.log.apply(console, arguments); },
    // Helpers (mongosh-ish):
    load: function (file, name) { return loadFile(ctx, file, name); },
    save: function (name, file) { return saveFile(name, file); },
    show: function (what) { return showText(what); },
  };
  vm.createContext(sandbox);
  ctx.sandbox = sandbox;
  return ctx;
}


/** List collection names with doc counts (for `show collections`). */
function collectionsList() {
  var names = mm._registry.names();
  return names.map(function (n) {
    return { name: n, count: mm.collection(n).toArray().length };
  });
}

function showText(what) {
  if (what === 'dbs' || what === 'databases') {
    return [ { name: 'micromongo', collections: mm._registry.names().length } ];
  }
  // default: collections
  return collectionsList();
}


/** Load a JSON file (an array of docs) into a named collection. */
function loadFile(ctx, file, name) {
  var raw = fs.readFileSync(file, 'utf-8');
  var arr = JSON.parse(raw);
  if (!Array.isArray(arr)) { throw new Error('load(): ' + file + ' must contain a JSON array of documents'); }
  mm.collection(name, arr);
  return { loaded: name, count: arr.length };
}

/** Save a collection back to a JSON file. */
function saveFile(name, file) {
  var arr = mm.collection(name).toArray();
  fs.writeFileSync(file, JSON.stringify(arr, null, 2) + '\n');
  return { saved: name, count: arr.length, file: file };
}

/**
 * Run a script file in the shell sandbox (like `mongosh script.js`). The whole
 * file is evaluated as JS with `db`/`mm`/helpers in scope; the script controls its
 * own output via print()/console.log. Returns the final expression's value.
 */
function runScript(ctx, file) {
  var code = fs.readFileSync(file, 'utf-8');
  return vm.runInContext(code, ctx.sandbox, { filename: file, timeout: 30000 });
}


/**
 * Evaluate one input line. Shell commands are handled first; otherwise the line is
 * run as JS in the sandbox. Returns the result value (a Cursor is materialized).
 * Special return: the string '__EXIT__' signals the REPL to quit.
 * @param {Object} ctx
 * @param {string} line
 */
function evalLine(ctx, line) {
  var trimmed = line.trim();
  if (trimmed === '') { return undefined; }

  // --- shell commands -------------------------------------------------------
  if (trimmed === 'exit' || trimmed === 'quit' || trimmed === '.exit') { return '__EXIT__'; }
  if (trimmed === 'help') { return helpText(); }

  var showMatch = /^show\s+(\w+)\s*;?$/.exec(trimmed);
  if (showMatch) { return showText(showMatch[1]); }

  var useMatch = /^use\s+(\S+)\s*;?$/.exec(trimmed);
  if (useMatch) {
    ctx.dbName = useMatch[1];
    return { switchedTo: ctx.dbName, note: 'single in-memory namespace; recorded for the prompt only' };
  }

  // --- JS evaluation in the sandbox ----------------------------------------
  var result = vm.runInContext(trimmed, ctx.sandbox, { timeout: 5000 });
  if (result instanceof Cursor) { return result.toArray(); } // mongosh shows the batch
  return result;
}


function helpText() {
  return [
    'micromongo shell — mongosh-flavored commands over an in-memory db.',
    '',
    '  show collections            list collections and their doc counts',
    '  show dbs                    list the (single) namespace',
    '  use <name>                  set the prompt namespace (single namespace; cosmetic)',
    '  load("file.json","name")    load a JSON array file as collection <name>',
    '  save("name","file.json")    write a collection back to a JSON file',
    '  help                        this help     exit / quit     leave the shell',
    '',
    '  db.<coll>.<method>(...)     anything the Collection/Cursor API supports, e.g.:',
    "    db.orders.find({ status: 'A' }).sort({ qty: -1 }).limit(2).toArray()",
    '    db.orders.createIndex({ status: 1 })',
    "    db.orders.find({ status: 'A' }).explain()",
    '    db.orders.aggregate([ { $group: { _id: "$status", n: { $sum: 1 } } } ])',
    '    mm.configure({ textSearch: "stemming" })',
  ].join('\n');
}


// Method/keyword lists derived by REFLECTION from the real API, so completion can
// never drift from what the code actually exposes. Public methods = own enumerable
// + prototype-chain function names that don't start with '_'.
function publicMethods(target) {
  var seen = {};
  var out = [];
  var obj = target;
  while (obj && obj !== Object.prototype) {
    Object.getOwnPropertyNames(obj).forEach(function (name) {
      if (seen[name] || name === 'constructor' || name.charAt(0) === '_') { return; }
      seen[name] = true;
      var val;
      try { val = obj[name]; } catch (e) { return; } // skip throwing getters
      if (typeof val === 'function') { out.push(name); }
    });
    obj = Object.getPrototypeOf(obj);
  }
  return out.sort();
}

var Collection = require('./collection');
var COLLECTION_METHODS = publicMethods(Collection.prototype);
var CURSOR_METHODS = publicMethods(Cursor.prototype);
// Top-level: the shell keywords + the public `mm` surface members (functions/objects).
var SHELL_KEYWORDS = [ 'db.', 'show collections', 'show dbs', 'use ', 'help', 'exit', 'load(', 'save(' ];
var TOP_LEVEL = SHELL_KEYWORDS.concat(
  Object.keys(mm).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return 'mm.' + k; })
).sort();

/**
 * Tab-completion for the REPL. Completes collection names after `db.`, Collection
 * methods after `db.<coll>.`, Cursor methods after a `.find(...).`, and the
 * top-level command keywords otherwise.
 * @returns {[Array<string>, string]} [hits, partial] — Node's completer contract.
 */
function completer(line) {
  // db.<coll>.<methodPartial>
  var m = /db\.([A-Za-z0-9_$]+)\.([A-Za-z0-9_$]*)$/.exec(line);
  if (m) {
    var partial = m[2];
    var hits = COLLECTION_METHODS.filter(function (x) { return x.indexOf(partial) === 0; });
    return [ hits.length ? hits : COLLECTION_METHODS, partial ];
  }
  // after a cursor: ….find(...).<methodPartial>  (heuristic: a ')' before the dot)
  var c = /\)\.([A-Za-z0-9_$]*)$/.exec(line);
  if (c) {
    var cp = c[1];
    var chits = CURSOR_METHODS.filter(function (x) { return x.indexOf(cp) === 0; });
    return [ chits.length ? chits : CURSOR_METHODS, cp ];
  }
  // db.<collPartial>
  var d = /db\.([A-Za-z0-9_$]*)$/.exec(line);
  if (d) {
    var cn = d[1];
    var names = mm._registry.names();
    var nhits = names.filter(function (x) { return x.indexOf(cn) === 0; });
    return [ nhits.length ? nhits : names, cn ];
  }
  // top-level
  var thits = TOP_LEVEL.filter(function (x) { return x.indexOf(line) === 0; });
  return [ thits.length ? thits : TOP_LEVEL, line ];
}


/** Format a result for display (mongosh-ish: pretty, depth-limited). */
function formatResult(value) {
  if (typeof value === 'undefined') { return undefined; }
  if (typeof value === 'string') { return value; }
  // A chainable method (e.g. createIndex) returns the Collection itself — don't
  // dump its internals; show a terse summary like mongosh does.
  if (value instanceof Collection) {
    return '{ collection: ' + value.toArray().length + ' docs, indexes: ['
      + value.getIndexes().join(', ') + '] }';
  }
  return util.inspect(value, { depth: 6, colors: false, maxArrayLength: 200 });
}


/**
 * Start an interactive REPL. Uses Node's `repl` with a custom evaluator (the
 * mongosh mini-language) and writer (cursor-aware pretty-print).
 * @param {Object} [opts] - { context } a pre-built ctx (e.g. with --load already applied)
 */
function startShell(opts) {
  var repl = require('repl');
  opts = opts || {};
  var ctx = opts.context || createContext();

  if (!opts.quiet) {
    console.log('micromongo shell — type "help", "show collections", or db.<coll>.<method>(...). "exit" to quit.');
  }

  var server = repl.start({
    prompt: ctx.dbName + '> ',
    eval: function (cmd, replCtx, filename, callback) {
      try {
        var result = evalLine(ctx, cmd);
        if (result === '__EXIT__') { server.close(); return callback(null); }
        callback(null, result);
      } catch (e) {
        callback(null, '[error] ' + (e && e.message ? e.message : String(e)));
      }
    },
    writer: function (value) {
      var out = formatResult(value);
      return typeof out === 'undefined' ? '' : out;
    },
    completer: completer,
  });
  return server;
}


module.exports = {
  createContext: createContext,
  evalLine: evalLine,
  formatResult: formatResult,
  loadFile: loadFile,
  runScript: runScript,
  startShell: startShell,
  helpText: helpText,
};
