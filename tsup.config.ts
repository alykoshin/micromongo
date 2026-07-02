import { defineConfig } from 'tsup';
import * as path from 'path';

// tsup (esbuild) consumes the TypeScript source and emits the targets `tsc` can't:
// native ESM and a browser IIFE. `tsc` stays the source-of-truth CJS + `.d.ts`
// compiler (the `export =` callable-with-statics modules emit exactly as before, and
// the `.d.ts` is shared by every consumer); tsup only ADDS artifacts to dist/.
//
//   - ESM (.mjs): `export =` is illegal under TS ESM mode (TS1203), so ESM must come
//     from a bundler reading the code, not a tsc recompile. esbuild exposes the CJS
//     `module.exports` value as the ESM default export. lodash is bundled in (no
//     runtime require); Node built-ins stay external and resolve via a `createRequire`
//     shim — only string `$where` ever reaches `vm`, a Node-only feature.
//   - browser IIFE (.global.js): a single <script> build attaching `window.micromongo`.
//     `vm` is aliased to a throwing stub (string `$where` is Node-only); everything
//     else runs in the browser.
//
// Node-only entries (cli, repl) are intentionally NOT built here — CJS-only by design.

const shared = {
  outDir: 'dist',
  dts: false,            // tsc already emits .d.ts
  sourcemap: true,
  clean: false,          // never wipe tsc's CJS output in dist/
  splitting: false,
  treeshake: true,
  minify: true,          // ship minified: ~243→96 KB raw, 46→31 KB gzipped (sourcemap kept)
  target: 'es2017' as const,
  noExternal: ['lodash'], // bundle lodash in (source reaches it via require('lodash/get'))
};

export default defineConfig([
  // --- Node ESM (.mjs) — full entry AND the lean functional-only `core` entry ---
  {
    ...shared,
    // `core` excludes the Collection/Cursor/index layer (see src/core.ts); it emits
    // dist/core.mjs, exposed as the `micromongo/core` subpath. `mock` is the
    // mongodb-driver adapter (src/mock), exposed as `micromongo/mock` → dist/mock/index.mjs.
    entry: { index: 'src/index.ts', core: 'src/core.ts', 'mock/index': 'src/mock/index.ts' },
    format: ['esm'],
    platform: 'neutral',
    outExtension() { return { js: '.mjs' }; },
    // `crypto`/`stream` (mock ObjectId + cursor.stream) and optional `bson` stay external —
    // Node built-ins resolve via the createRequire banner; `bson` is a guarded optional require.
    external: ['vm', 'fs', 'util', 'repl', 'assert', 'crypto', 'stream', 'bson'],
    // Native ESM has no `require`; the bundled source reaches Node built-ins via
    // `require('vm')`. Inject a real require so those external requires resolve at
    // runtime (Node only; in the browser these built-ins are simply absent).
    banner: {
      js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
    },
  },
  // --- browser IIFE (window.micromongo) — full entry only ---
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    platform: 'browser',
    globalName: 'micromongo',
    outExtension() { return { js: '.global.js' }; },
    // No Node built-ins in the browser: alias `vm` and `stream` to throwing stubs (string
    // $where and Cursor.stream() are Node-only; every other cursor terminal works in the
    // browser). The CLI-only fs/util/repl never enter this entry (index.ts).
    esbuildOptions(options) {
      options.alias = {
        vm: path.resolve(__dirname, 'src/vm-browser-stub.ts'),
        stream: path.resolve(__dirname, 'src/stream-browser-stub.ts'),
      };
    },
  },
]);
