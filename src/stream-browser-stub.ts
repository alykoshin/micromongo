'use strict';

// Browser stub for Node's `stream` module. `Cursor.stream()` returns a Node Readable, which
// has no browser equivalent — so in the browser IIFE build we alias `require('stream')` to
// this. Calling `.stream()` throws a clear error; every OTHER cursor terminal (toArray,
// for…of, for await, next/hasNext) works in the browser unchanged (they don't touch `stream`).
// Mirrors the `vm` → vm-browser-stub aliasing (see tsup.config.ts).

function Readable(): never {
  throw new Error(
    'Cursor.stream() returns a Node.js Readable stream and is not available in the browser build. ' +
    'Use toArray(), for…of / for await…of, or next()/hasNext() instead.'
  );
}

export = { Readable: Readable };
