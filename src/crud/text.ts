/**
 * In-memory text search for the $text query operator and $meta:"textScore".
 *
 * Three pluggable fidelity modes, selected via `mm.configure({ textSearch })`:
 *
 *   'lightweight' (default) — lowercase + tokenize on non-word chars, EXACT-token
 *       matching, simple term-frequency score. Zero linguistic processing. The
 *       cheapest, dependency-free default; upgrade via configure() when you need
 *       stemming/diacritics.
 *
 *   'stemming' — adds diacritic folding (lodash.deburr), stop-word removal, and a
 *       vendored Porter stemmer (so "running"/"ran" reduce toward "run"). Matching
 *       behavior is much closer to MongoDB; score is still a simple TF.
 *
 *   'exact' — same normalization as 'stemming', plus a relevance score derived from
 *       MongoDB's open-source fts_spec.cpp coefficient. Closer score *shape* than TF,
 *       but NOT byte-identical to MongoDB (see LIMITATIONS below).
 *
 * LIMITATIONS (all modes):
 *   - No 2dsphere/text index, no persistence — tokenization happens per query
 *     (linear scan), matching the library's unindexed design.
 *   - 'lightweight' does NOT stem or drop stop words: searching "run" will not
 *     match "running".
 *   - The Porter stemmer (used by 'stemming'/'exact') is the classic English Porter
 *     algorithm, which Snowball-English is *based on* but is not byte-identical to
 *     MongoDB's Snowball stemmer; a few words stem differently.
 *   - Only the default English language is modeled (no per-language stop-words/stemming).
 *   - $meta:"textScore" returns a *relevance ordering* that is sensible but whose
 *     numeric values do NOT equal MongoDB's. Even 'exact' mode approximates the
 *     undisclosed-in-docs (but open-source) formula; field weights are not modeled.
 *   - Phrase ("\"...\"") and term negation ("-word") are supported; $language,
 *     $caseSensitive, $diacriticSensitive options are not.
 *
 * For true full-text fidelity, use a real search engine (MongoDB Atlas Search).
 */

'use strict';

var deburr = require('lodash/deburr');

var settings = require('../settings');

import type { Document } from '../types';


// --- vendored Porter stemmer (classic English algorithm; no dependency) -------
// Compact implementation of the Porter (1980) stemming algorithm.

var step2list: {[suffix: string]: string} = {
  ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize',
  bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize',
  ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful',
  ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log',
};
var step3list: {[suffix: string]: string} = {
  icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '',
};
var c = '[^aeiou]', v = '[aeiouy]';
var C = c + '[^aeiouy]*', V = v + '[aeiou]*';
var mgr0 = '^(' + C + ')?' + V + C;
var meq1 = '^(' + C + ')?' + V + C + '(' + V + ')?$';
var mgr1 = '^(' + C + ')?' + V + C + V + C;
var s_v = '^(' + C + ')?' + v;

function porterStem(w: string): string {
  if (w.length < 3) { return w; }
  var firstch = w.substr(0, 1);
  if (firstch === 'y') { w = firstch.toUpperCase() + w.substr(1); }

  var re, re2, re3, re4, stem, suffix;

  // Step 1a
  re = /^(.+?)(ss|i)es$/; re2 = /^(.+?)([^s])s$/;
  if (re.test(w)) { w = w.replace(re, '$1$2'); } else if (re2.test(w)) { w = w.replace(re2, '$1$2'); }

  // Step 1b
  re = /^(.+?)eed$/; re2 = /^(.+?)(ed|ing)$/;
  if (re.test(w)) { var fp: any = re.exec(w); re = new RegExp(mgr0); if (re.test(fp[1])) { re = /.$/; w = w.replace(re, ''); } }
  else if (re2.test(w)) {
    var fp2: any = re2.exec(w); stem = fp2[1]; re2 = new RegExp(s_v);
    if (re2.test(stem)) {
      w = stem;
      re2 = /(at|bl|iz)$/; re3 = new RegExp('([^aeiouylsz])\\1$'); re4 = new RegExp('^' + C + v + '[^aeiouwxy]$');
      if (re2.test(w)) { w = w + 'e'; }
      else if (re3.test(w)) { re = /.$/; w = w.replace(re, ''); }
      else if (re4.test(w)) { w = w + 'e'; }
    }
  }

  // Step 1c
  re = /^(.+?)y$/;
  if (re.test(w)) { var fp1c: any = re.exec(w); stem = fp1c[1]; re = new RegExp(s_v); if (re.test(stem)) { w = stem + 'i'; } }

  // Step 2
  re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
  if (re.test(w)) { var fp2b: any = re.exec(w); stem = fp2b[1]; suffix = fp2b[2]; re = new RegExp(mgr0); if (re.test(stem)) { w = stem + step2list[suffix]; } }

  // Step 3
  re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
  if (re.test(w)) { var fp3: any = re.exec(w); stem = fp3[1]; suffix = fp3[2]; re = new RegExp(mgr0); if (re.test(stem)) { w = stem + step3list[suffix]; } }

  // Step 4
  re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/; re2 = /^(.+?)(s|t)(ion)$/;
  if (re.test(w)) { var fp4: any = re.exec(w); stem = fp4[1]; re = new RegExp(mgr1); if (re.test(stem)) { w = stem; } }
  else if (re2.test(w)) { var fp4b: any = re2.exec(w); stem = fp4b[1] + fp4b[2]; re2 = new RegExp(mgr1); if (re2.test(stem)) { w = stem; } }

  // Step 5
  re = /^(.+?)e$/;
  if (re.test(w)) { var fp5: any = re.exec(w); stem = fp5[1]; re = new RegExp(mgr1); re2 = new RegExp(meq1); re3 = new RegExp('^' + C + v + '[^aeiouwxy]$'); if (re.test(stem) || (re2.test(stem) && !re3.test(stem))) { w = stem; } }
  re = /ll$/; re2 = new RegExp(mgr1);
  if (re.test(w) && re2.test(w)) { re = /.$/; w = w.replace(re, ''); }

  if (firstch === 'y') { w = firstch + w.substr(1); }
  return w;
}


// A small English stop-word list (subset of the common MongoDB/Snowball set).
var STOP_WORDS: {[word: string]: number} = {
  a: 1, an: 1, and: 1, are: 1, as: 1, at: 1, be: 1, but: 1, by: 1, for: 1,
  if: 1, in: 1, into: 1, is: 1, it: 1, no: 1, not: 1, of: 1, on: 1, or: 1,
  such: 1, that: 1, the: 1, their: 1, then: 1, there: 1, these: 1, they: 1,
  this: 1, to: 1, was: 1, will: 1, with: 1,
};


/** Current text-search mode (read at use, so configure() takes effect). */
function mode(): string {
  var m = settings.textSearch;
  return (m === 'stemming' || m === 'exact') ? m : 'lightweight';
}

/** Tokenize a string into normalized terms according to the active mode. */
function tokenize(str: any, m?: string): string[] {   // str: any — guarded; non-strings return []
  if (typeof str !== 'string') { return []; }
  m = m || mode();
  if (m === 'lightweight') {
    return str.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  // stemming / exact: deburr (diacritics) FIRST so 'café' folds to 'cafe' before
  // the split treats accented chars as separators; then drop stop words & Porter-stem.
  var raw = deburr(str).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  var out = [];
  for (var i = 0; i < raw.length; ++i) {
    if (STOP_WORDS[raw[i]]) { continue; }
    out.push(porterStem(raw[i]));
  }
  return out;
}

/** Concatenate all string field values of a document into one searchable blob. */
function docText(doc: Document): string {
  var parts: string[] = [];
  (function walk(v: any) {   // v: any — genuine value (string/array/object/scalar) walked recursively
    if (typeof v === 'string') { parts.push(v); }
    else if (Array.isArray(v)) { v.forEach(walk); }
    else if (v && typeof v === 'object') { for (var k in v) { if (v.hasOwnProperty(k)) { walk(v[k]); } } }
  })(doc);
  return parts.join(' ');
}

/**
 * Parse a $search string into { terms: [...], phrases: [["a","b"],...], negations: [...] }.
 * Quoted "..." are phrases; -term are negations; the rest are OR terms.
 */
function parseSearch(search: string, m?: string) {
  var terms: string[] = [], phrases: string[][] = [], negations: string[] = [];
  var re = /"([^"]+)"|(\S+)/g, match;
  while ((match = re.exec(search)) !== null) {
    if (match[1] !== undefined) {
      phrases.push(tokenize(match[1], m));
    } else {
      var w = match[2];
      if (w.charAt(0) === '-') { negations.push.apply(negations, tokenize(w.slice(1), m)); }
      else { terms.push.apply(terms, tokenize(w, m)); }
    }
  }
  return { terms: terms, phrases: phrases, negations: negations };
}

/**
 * The module value: the callable `search(doc, searchStr)` plus the statics that
 * the $text operator, the $meta projection, and the test suite reach for. The
 * callable is ALSO exposed as `.search` (so `require('./text').search` resolves
 * to the same function). Typed as one interface for `export = search`.
 */
interface SearchFn {
  (doc: Document, searchStr: string): { match: boolean; score: number };
  search: (doc: Document, searchStr: string) => { match: boolean; score: number };
  setScore: (doc: Document, score: number) => void;
  getScore: (doc: Document) => number | undefined;
  tokenize: (str: any, m?: string) => string[];
  porterStem: (w: string) => string;
  mode: () => string;
}

/**
 * Does `doc` match the $text search, and what is its relevance score?
 * @returns the match flag and relevance score
 */
var search = (function (doc: Document, searchStr: string): { match: boolean; score: number } {
  var m = mode();
  var docTokens = tokenize(docText(doc), m);
  var tokenSet: {[token: string]: number} = {};
  for (var i = 0; i < docTokens.length; ++i) { tokenSet[docTokens[i]] = (tokenSet[docTokens[i]] || 0) + 1; }

  var parsed = parseSearch(searchStr, m);

  // Negations exclude the doc entirely.
  for (var n = 0; n < parsed.negations.length; ++n) {
    if (tokenSet[parsed.negations[n]]) { return { match: false, score: 0 }; }
  }

  // Phrases: require the consecutive sequence to appear in the doc tokens.
  for (var p = 0; p < parsed.phrases.length; ++p) {
    if (!containsSequence(docTokens, parsed.phrases[p])) { return { match: false, score: 0 }; }
  }

  // OR terms: at least one must appear (if any terms given). Phrases already counted.
  var hitCount = 0, totalTermFreq = 0;
  for (var t = 0; t < parsed.terms.length; ++t) {
    var f = tokenSet[parsed.terms[t]] || 0;
    if (f > 0) { hitCount++; totalTermFreq += f; }
  }
  // A phrase match also counts as a hit.
  var phraseHit = parsed.phrases.length > 0;

  if (parsed.terms.length > 0 && hitCount === 0 && !phraseHit) {
    return { match: false, score: 0 };
  }
  if (parsed.terms.length === 0 && parsed.phrases.length === 0) {
    return { match: false, score: 0 }; // empty search matches nothing
  }

  var score = relevance(totalTermFreq, hitCount, docTokens.length, m) + (phraseHit ? 1 : 0);
  return { match: true, score: score };
}) as SearchFn;

/** Relevance score. 'exact' uses the fts_spec coefficient shape; others use plain TF. */
function relevance(totalTermFreq: number, hitCount: number, numTokens: number, m: string): number {
  if (totalTermFreq === 0) { return 0; }
  if (m === 'exact' && numTokens > 0) {
    // MongoDB fts_spec.cpp coefficient: coeff = (0.5 * count / numTokens) + 0.5,
    // summed across matched terms. Approximation (field weights not modeled).
    return (0.5 * totalTermFreq / numTokens + 0.5) * hitCount;
  }
  return totalTermFreq; // lightweight / stemming: term-frequency
}

function containsSequence(tokens: string[], seq: string[]): boolean {
  if (seq.length === 0) { return true; }
  for (var i = 0; i + seq.length <= tokens.length; ++i) {
    var ok = true;
    for (var j = 0; j < seq.length; ++j) { if (tokens[i + j] !== seq[j]) { ok = false; break; } }
    if (ok) { return true; }
  }
  return false;
}


// --- relevance-score side channel --------------------------------------------
// $text stashes the matched document's score here; a $meta:"textScore" projection
// retrieves it. Keyed by document identity (WeakMap), so docs are not mutated.
var scoreMap = new WeakMap();

function setScore(doc: Document, score: number): void {
  if (doc && typeof doc === 'object') { scoreMap.set(doc, score); }
}
function getScore(doc: Document): number | undefined {
  return (doc && typeof doc === 'object' && scoreMap.has(doc)) ? scoreMap.get(doc) : undefined;
}


search.search = search;
search.setScore = setScore;
search.getScore = getScore;
search.tokenize = tokenize;
search.porterStem = porterStem;
search.mode = mode;

export = search;
