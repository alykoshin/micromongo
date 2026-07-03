#!/usr/bin/env node
'use strict';

// gen-badges.js — generate self-contained status SVG badges from REAL test/coverage
// numbers, committed into docs/badges/ and referenced by the README.
//
// Why local badges: this repo has no cloud CI (GitHub Actions is unavailable on the
// account's Free plan), so there's no live shields.io/coveralls endpoint to hit. Instead
// we render the badges OFFLINE from the numbers a local `npm test` already produces, and
// commit the SVGs (served by GitHub Pages under docs/badges/, so the README badges work
// on GitHub too). Regenerate whenever tests/coverage change — wired into `_test-report`.
//
// Inputs (produced by the test run):
//   - coverage/coverage-summary.json   (nyc --reporter=json-summary)  -> coverage %
//   - coverage/mocha-results.json      (mocha --reporter=json)        -> tests passing
// Either missing input is skipped (that badge just isn't regenerated) so the script is
// safe to run even if only one reporter ran.
//
// Run: node scripts/gen-badges.js   (or via `npm run gen-badges`)

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var OUT_DIR = path.join(ROOT, 'docs', 'badges');

// -- SVG rendering (flat "shields" style, self-contained, no network) --------------

// Approximate text width (px) at the 11px font shields uses. Character widths vary;
// 6.5px/char is a good average that keeps padding sane for these short labels.
function textWidth(s) { return Math.ceil(String(s).length * 6.5); }

// Build a two-part flat badge: grey label box + colored message box.
function badgeSvg(label, message, color) {
  var padX = 6;
  var lw = textWidth(label) + padX * 2;
  var mw = textWidth(message) + padX * 2;
  var w = lw + mw;
  var lx = lw / 2;                 // label text center
  var mx = lw + mw / 2;            // message text center
  // Text is drawn twice (a dark shadow at y=15 then the real text at y=14) — the
  // standard shields trick for legibility on any background.
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="20" role="img" aria-label="' + esc(label) + ': ' + esc(message) + '">',
    '<title>' + esc(label) + ': ' + esc(message) + '</title>',
    '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>',
    '<clipPath id="r"><rect width="' + w + '" height="20" rx="3" fill="#fff"/></clipPath>',
    '<g clip-path="url(#r)">',
    '<rect width="' + lw + '" height="20" fill="#555"/>',
    '<rect x="' + lw + '" width="' + mw + '" height="20" fill="' + color + '"/>',
    '<rect width="' + w + '" height="20" fill="url(#s)"/>',
    '</g>',
    '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">',
    '<text x="' + lx + '" y="15" fill="#010101" fill-opacity=".3">' + esc(label) + '</text>',
    '<text x="' + lx + '" y="14">' + esc(label) + '</text>',
    '<text x="' + mx + '" y="15" fill="#010101" fill-opacity=".3">' + esc(message) + '</text>',
    '<text x="' + mx + '" y="14">' + esc(message) + '</text>',
    '</g>',
    '</svg>',
  ].join('');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Coverage color thresholds, matching the coveralls/shields convention.
function covColor(pct) {
  if (pct >= 90) { return '#4c1'; }        // brightgreen
  if (pct >= 80) { return '#97ca00'; }     // green
  if (pct >= 70) { return '#a4a61d'; }     // yellowgreen
  if (pct >= 60) { return '#dfb317'; }     // yellow
  if (pct >= 50) { return '#fe7d37'; }     // orange
  return '#e05d44';                        // red
}

function writeBadge(name, svg) {
  var file = path.join(OUT_DIR, name + '.svg');
  fs.writeFileSync(file, svg);
  console.log('  wrote ' + path.relative(ROOT, file));
}

function main() {
  if (!fs.existsSync(OUT_DIR)) { fs.mkdirSync(OUT_DIR, { recursive: true }); }
  var wrote = 0;

  // --- tests badge (from mocha json reporter) ---
  var mochaFile = path.join(ROOT, 'coverage', 'mocha-results.json');
  if (fs.existsSync(mochaFile)) {
    var stats = JSON.parse(fs.readFileSync(mochaFile, 'utf8')).stats || {};
    var passes = stats.passes || 0;
    var failures = stats.failures || 0;
    var msg = failures ? (passes + ' passing, ' + failures + ' failing')
                       : (passes + ' passing');
    var color = failures ? '#e05d44' : '#4c1';
    writeBadge('tests', badgeSvg('tests', msg, color));
    wrote++;
  } else {
    console.warn('  (skip tests badge: coverage/mocha-results.json not found — run `npm run _test-mocha-json`)');
  }

  // --- coverage badge (from nyc json-summary) ---
  var covFile = path.join(ROOT, 'coverage', 'coverage-summary.json');
  if (fs.existsSync(covFile)) {
    var pct = JSON.parse(fs.readFileSync(covFile, 'utf8')).total.lines.pct;
    writeBadge('coverage', badgeSvg('coverage', pct + '%', covColor(pct)));
    wrote++;
  } else {
    console.warn('  (skip coverage badge: coverage/coverage-summary.json not found — run nyc with --reporter=json-summary)');
  }

  if (!wrote) {
    console.warn('gen-badges: nothing generated (no input files). Run the test suite first.');
  }
}

main();
