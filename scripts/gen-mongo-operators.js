#!/usr/bin/env node
'use strict';

/**
 * gen-mongo-operators.js — build-time codegen (Phase T2.7).
 *
 * Extracts MongoDB's authoritative query/update operator *name sets* from the
 * `mongodb` driver's TypeScript types (`FilterOperators` / `UpdateFilter` /
 * `RootFilterOperators`) via the TypeScript Compiler API, and writes them to
 * `test/crud/match/mongo-operators.generated.json`.
 *
 * The drift guard ([test/crud/match/filter-operators-drift.js]) reads that JSON to
 * verify micromongo's operator vocabulary stays a documented subset of Mongo's.
 *
 * `mongodb` is a **devDependency only** — it is used HERE at build time and never
 * enters `dependencies` or the shipped `dist/`. We extract only the operator NAMES
 * (not the value types, which would drag in BSON/ObjectId); the per-operator value
 * typing in `src/types.ts` stays hand-written.
 *
 * Run:  npm run gen-mongo-operators   (refresh after bumping the `mongodb` devDep).
 * Requires Node >= 20 (the `mongodb` driver's floor) to run — but the generated
 * JSON is committed, so normal build/test on older Node is unaffected.
 */

var ts = require('typescript');
var fs = require('fs');
var path = require('path');

var OUT = path.resolve(__dirname, '..', 'test', 'crud', 'match', 'mongo-operators.generated.json');

// A throwaway source that references the Mongo types we want to introspect.
var probeSource = [
  "import type { FilterOperators, UpdateFilter, RootFilterOperators } from 'mongodb';",
  'declare const _filter: FilterOperators<any>;',
  'declare const _update: UpdateFilter<any>;',
  'declare const _root: RootFilterOperators<any>;',
].join('\n');

var probePath = path.resolve(__dirname, '_mongo-ops-probe.ts');
fs.writeFileSync(probePath, probeSource);

try {
  var program = ts.createProgram([probePath], {
    strict: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  });
  var checker = program.getTypeChecker();
  var sf = program.getSourceFile(probePath);
  if (!sf) { throw new Error('could not load the probe source file'); }

  // Extract the `$`-prefixed property names of the type a given `declare const` has.
  function operatorKeysOf(varName) {
    var found = null;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(function (d) {
          if (d.name.getText() === varName) {
            var t = checker.getTypeAtLocation(d);
            found = checker.getPropertiesOfType(t)
              .map(function (p) { return p.name; })
              .filter(function (name) { return name.charAt(0) === '$'; })
              .sort();
          }
        });
      }
      ts.forEachChild(node, visit);
    });
    if (!found) { throw new Error('could not resolve type for ' + varName + ' — did the mongodb type names change?'); }
    return found;
  }

  var mongoVersion = require('mongodb/package.json').version;
  var data = {
    _comment: 'GENERATED from mongodb@' + mongoVersion + ' by scripts/gen-mongo-operators.js — do not edit. Run `npm run gen-mongo-operators` to refresh.',
    mongodbVersion: mongoVersion,
    filterOperators: operatorKeysOf('_filter'),
    updateOperators: operatorKeysOf('_update'),
    rootOperators: operatorKeysOf('_root'),
  };

  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log('Wrote ' + path.relative(process.cwd(), OUT));
  console.log('  filterOperators: ' + data.filterOperators.length);
  console.log('  updateOperators: ' + data.updateOperators.length);
  console.log('  rootOperators:   ' + data.rootOperators.length);
} finally {
  fs.unlinkSync(probePath);
}
