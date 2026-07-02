'use strict';

// Ported from test/crud/find-evaluationQuery-mongodoc.js, $comment-mongodoc.js

module.exports = [

  // ---- $mod ----------------------------------------------------------------
  {
    op: '$mod',
    kind: 'queryOp',
    title: 'Use $mod to Select Documents',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/mod/',
    fixture: [
      { "_id": 1, "item": "abc123", "qty": 0 },
      { "_id": 2, "item": "xyz123", "qty": 5 },
      { "_id": 3, "item": "ijk123", "qty": 12 },
    ],
    do: { find: { query: { qty: { $mod: [ 4, 0 ] } } } },
    expect: [
      { "_id": 1, "item": "abc123", "qty": 0 },
      { "_id": 3, "item": "ijk123", "qty": 12 },
    ],
    real: 'exact',
    docs: true,
  },

  // ---- $regex --------------------------------------------------------------
  {
    op: '$regex',
    kind: 'queryOp',
    title: 'Perform Case-Insensitive Regular Expression Match',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/regex/',
    fixture: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
      { "_id": 102, "sku": "xyz456", "description": "Many spaces before     line" },
      { "_id": 103, "sku": "xyz789", "description": "Multiple\nline description" },
    ],
    do: { find: { query: { sku: { $regex: /^ABC/i } } } },
    expect: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$regex',
    kind: 'queryOp',
    title: 'Multiline Match for Lines Starting with Specified Pattern (m option)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/regex/',
    fixture: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
      { "_id": 102, "sku": "xyz456", "description": "Many spaces before     line" },
      { "_id": 103, "sku": "xyz789", "description": "Multiple\nline description" },
    ],
    do: { find: { query: { description: { $regex: /^S/, $options: 'm' } } } },
    expect: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$regex',
    kind: 'queryOp',
    title: 'Multiline Match without the m option',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/regex/',
    fixture: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
      { "_id": 102, "sku": "xyz456", "description": "Many spaces before     line" },
      { "_id": 103, "sku": "xyz789", "description": "Multiple\nline description" },
    ],
    do: { find: { query: { description: { $regex: /^S/ } } } },
    expect: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$regex',
    kind: 'queryOp',
    title: 'Multiline Match, pattern does not contain an anchor',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/regex/',
    fixture: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
      { "_id": 102, "sku": "xyz456", "description": "Many spaces before     line" },
      { "_id": 103, "sku": "xyz789", "description": "Multiple\nline description" },
    ],
    do: { find: { query: { description: { $regex: /S/ } } } },
    expect: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$regex',
    kind: 'queryOp',
    title: 'Use the . Dot Character to Match New Line (without the s option)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/regex/',
    fixture: [
      { "_id": 100, "sku": "abc123", "description": "Single line description." },
      { "_id": 101, "sku": "abc789", "description": "First line\nSecond line" },
      { "_id": 102, "sku": "xyz456", "description": "Many spaces before     line" },
      { "_id": 103, "sku": "xyz789", "description": "Multiple\nline description" },
    ],
    do: { find: { query: { description: { $regex: /m.*line/, $options: 'i' } } } },
    expect: [
      { "_id": 102, "sku": "xyz456", "description": "Many spaces before     line" },
    ],
    real: 'exact',
    docs: false,
  },

  // ---- $where --------------------------------------------------------------
  // $where string form is Node-vm only; not portable to compare against live Mongo.
  {
    op: '$where',
    kind: 'queryOp',
    title: '$where string: this.credits == this.debits',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: { $where: "this.credits == this.debits" } } },
    expect: [
      { credits: 1, debits: 1 },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: true,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where string: obj.credits == obj.debits',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: { $where: "obj.credits == obj.debits" } } },
    expect: [
      { credits: 1, debits: 1 },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where function: return (this.credits == this.debits)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: { $where: function() { return (this.credits == this.debits) } } } },
    expect: [
      { credits: 1, debits: 1 },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where function: return obj.credits == obj.debits',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: { $where: function() { return obj.credits == obj.debits; } } } },
    expect: [
      { credits: 1, debits: 1 },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where bare string expression: this.credits == this.debits || this.credits > this.debits',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: "this.credits == this.debits || this.credits > this.debits" } },
    expect: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where bare function: return (this.credits == this.debits || this.credits > this.debits)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: function() { return (this.credits == this.debits || this.credits > this.debits ) } } },
    expect: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where combined with standard operators (string form)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: { active: true, $where: "this.credits - this.debits < 0" } } },
    expect: [
      { credits: 1, debits: 2, active: true },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  {
    op: '$where',
    kind: 'queryOp',
    title: '$where combined with standard operators (function form)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/where/',
    fixture: [
      { credits: 1, debits: 0 },
      { credits: 1, debits: 1 },
      { credits: 1, debits: 2, active: false },
      { credits: 1, debits: 2, active: true },
    ],
    do: { find: { query: { active: true, $where: function() { return obj.credits - obj.debits < 0; } } } },
    expect: [
      { credits: 1, debits: 2, active: true },
    ],
    real: 'skip:$where string form is Node-vm only; not portable to compare',
    docs: false,
  },

  // ---- $comment ------------------------------------------------------------
  // micromongo logs the $comment string to console.log (harmless); the find
  // result is still asserted here.
  {
    op: '$comment',
    kind: 'queryOp',
    title: '$comment passed alongside a query',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/comment/',
    fixture: [ { x: 0 }, { x: 1 }, { x: 2 } ],
    do: { find: { query: { x: { $mod: [ 2, 0 ] }, $comment: 'Find even values.' } } },
    expect: [ { x: 0 }, { x: 2 } ],
    real: 'exact',
    docs: true,
  },

];
