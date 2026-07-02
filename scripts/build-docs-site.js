#!/usr/bin/env node
'use strict';

// build-docs-site.js — assemble the self-contained GitHub Pages site under docs/.
//
// The doc page (docs/index.html) runs the REAL engine in the browser via the IIFE
// bundle. GitHub Pages serves only what's committed, so we copy the freshly-built
// bundle next to the page (docs/micromongo.global.js) rather than referencing
// dist/ (gitignored). Run `npm run build:bundles` first (or use `npm run gen-docs`,
// which chains both). This script only copies artifacts — index.html is authored
// by hand, not generated.

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DOCS = path.join(ROOT, 'docs');
var SRC_BUNDLE = path.join(ROOT, 'dist', 'index.global.js');
var DST_BUNDLE = path.join(DOCS, 'micromongo.global.js');

function main() {
  if (!fs.existsSync(SRC_BUNDLE)) {
    console.error(
      'Missing ' + path.relative(ROOT, SRC_BUNDLE) +
      ' — run `npm run build:bundles` first.'
    );
    process.exit(1);
  }
  if (!fs.existsSync(DOCS)) fs.mkdirSync(DOCS, { recursive: true });

  fs.copyFileSync(SRC_BUNDLE, DST_BUNDLE);
  var bytes = fs.statSync(DST_BUNDLE).size;
  console.log(
    'Copied ' + path.relative(ROOT, SRC_BUNDLE) + ' → ' +
    path.relative(ROOT, DST_BUNDLE) + ' (' + (bytes / 1024).toFixed(1) + ' KB)'
  );

  // .nojekyll — tell GitHub Pages to serve files verbatim (no Jekyll processing).
  var nojekyll = path.join(DOCS, '.nojekyll');
  if (!fs.existsSync(nojekyll)) {
    fs.writeFileSync(nojekyll, '');
    console.log('Wrote docs/.nojekyll');
  }
}

main();
