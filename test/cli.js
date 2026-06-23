/**
 * CLI + mongosh-flavored shell (lib/repl.js + cli.js).
 *
 * Most logic lives in the evaluator (lib/repl.js), unit-tested directly here; a
 * couple of execFileSync smoke tests cover the cli.js wiring (eval one-shot +
 * legacy functional form). The shell/eval/legacy modes are a micromongo-specific
 * tool with no MongoDB operator surface → plain unit tests (exempt from -mongodoc).
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;
var path = require('path');
var execFileSync = require('child_process').execFileSync;

var mm = require('../lib/');
var repl = require('../lib/repl');

var CLI = path.join(__dirname, '..', 'cli.js');
var ORDERS = [
  { _id: 1, status: 'A', qty: 50 },
  { _id: 2, status: 'B', qty: 20 },
  { _id: 3, status: 'A', qty: 90 },
];


describe('# CLI shell evaluator (lib/repl.js)', function () {

  var ctx;
  beforeEach(function () {
    mm._registry.reset();
    mm.collection('orders', ORDERS.map(function (d) { return { _id: d._id, status: d.status, qty: d.qty }; }));
    ctx = repl.createContext();
  });

  it('# db.<coll>.find(...).toArray() returns matching docs', function () {
    var r = repl.evalLine(ctx, "db.orders.find({status:'A'}).toArray()");
    expect(r.map(function (d) { return d._id; }).sort()).eql([ 1, 3 ]);
  });

  it('# a bare Cursor result is auto-materialized to an array', function () {
    var r = repl.evalLine(ctx, "db.orders.find({status:'A'})"); // no .toArray()
    expect(Array.isArray(r)).eql(true);
    expect(r).length(2);
  });

  it('# relaxed mongosh arg syntax (unquoted keys, single quotes) works', function () {
    var r = repl.evalLine(ctx, 'db.orders.find({ status: "B" }).toArray()');
    expect(r).length(1);
    expect(r[0]._id).eql(2);
  });

  it('# chaining sort/limit', function () {
    var r = repl.evalLine(ctx, "db.orders.find({status:'A'}).sort({qty:-1}).limit(1).toArray()");
    expect(r.map(function (d) { return d.qty; })).eql([ 90 ]);
  });

  it('# createIndex + explain reports an IXSCAN plan', function () {
    repl.evalLine(ctx, 'db.orders.createIndex({status:1})');
    var e = repl.evalLine(ctx, "db.orders.find({status:'A'}).explain()");
    expect(e.stage).eql('IXSCAN');
    expect(e.plan.usedHash).eql(true);
  });

  it('# aggregate', function () {
    var r = repl.evalLine(ctx, 'db.orders.aggregate([{$group:{_id:"$status",n:{$sum:1}}}])');
    var byId = {}; r.forEach(function (g) { byId[g._id] = g.n; });
    expect(byId).eql({ A: 2, B: 1 });
  });

  it('# show collections lists names + counts', function () {
    var r = repl.evalLine(ctx, 'show collections');
    expect(r).eql([ { name: 'orders', count: 3 } ]);
  });

  it('# use <name> is accepted (single namespace, cosmetic)', function () {
    var r = repl.evalLine(ctx, 'use mydb');
    expect(r.switchedTo).eql('mydb');
    expect(ctx.dbName).eql('mydb');
  });

  it('# exit / quit signal the REPL to close', function () {
    expect(repl.evalLine(ctx, 'exit')).eql('__EXIT__');
    expect(repl.evalLine(ctx, 'quit')).eql('__EXIT__');
  });

  it('# help returns text', function () {
    expect(repl.evalLine(ctx, 'help')).to.be.a('string').and.match(/show collections/);
  });

  it('# mm surface is reachable (configure)', function () {
    var r = repl.evalLine(ctx, 'mm.configure()');
    expect(r).to.have.property('textSearch');
  });
});


describe('# CLI formatting', function () {
  it('# a returned Collection is summarized, not dumped', function () {
    mm._registry.reset();
    var c = mm.collection('x', [ { a: 1 } ]);
    c.createIndex('a');
    var out = repl.formatResult(c);
    expect(out).match(/collection: 1 docs/);
    expect(out).match(/indexes: \[a\]/);
    expect(out).to.not.match(/_data/); // internals not exposed
  });
});


describe('# CLI process (cli.js wiring, mongosh-flavored)', function () {
  this.timeout(20000);

  var ordersFile = path.join(__dirname, '..', 'examples', 'cli', 'orders.json');

  function run(args, opts) {
    opts = opts || {};
    try {
      return { code: 0, out: execFileSync('node', [ CLI ].concat(args), { input: opts.input, encoding: 'utf-8' }) };
    } catch (e) {
      return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  }

  it('# --eval evaluates a db expression and prints the result', function () {
    var r = run([ '--eval', "db.orders.find({status:'A'}).count()", '--load', ordersFile + ':orders' ]);
    expect(r.out.trim()).eql('3'); // examples/cli/orders.json has 3 status-A docs
  });

  it('# repeatable --eval prints only the last result (mongosh rule)', function () {
    var r = run([
      '--eval', 'db.orders.createIndex({status:1})',
      '--eval', "db.orders.find({status:'A'}).explain().stage",
      '--load', ordersFile + ':orders',
    ]);
    expect(r.out.trim()).eql('IXSCAN');
  });

  it('# --json prints JSON', function () {
    var r = run([ '--json', '--eval', "db.orders.find({status:'B'}).toArray()", '--load', ordersFile + ':orders' ]);
    var parsed = JSON.parse(r.out);
    expect(parsed).length(1);
    expect(parsed[0].status).eql('B');
  });

  it('# --version', function () {
    var r = run([ '--version' ]);
    expect(r.out).match(/micromongo \d/);
  });

  it('# --help prints mongosh-flavored usage (no legacy/subcommands)', function () {
    var r = run([ '--help' ]);
    expect(r.out).match(/--eval/).and.match(/--file/).and.match(/--load/);
    expect(r.out).to.not.match(/\bshell <|\beval </); // no invented subcommands
  });

  it('# a stray positional is rejected (no server to connect to) with exit 1', function () {
    var r = run([ 'find', '[{"a":1}]' ]);
    expect(r.code).eql(1);
    expect(r.out).match(/no server to connect to/);
  });
});
