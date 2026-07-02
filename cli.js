#!/usr/bin/env node
'use strict';

// Thin shim: the CLI is compiled from src/cli.js to dist/cli.js.
// Kept at the repo root so package.json "bin" resolves a stable path with
// the shebang preserved (tsc does not reliably emit a shebang on the first line).
require('./dist/cli.js');
