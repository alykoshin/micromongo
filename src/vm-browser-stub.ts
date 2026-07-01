'use strict';

// Browser evaluator for string `$where`, aliased in place of Node's `vm` in the
// browser IIFE build only (see tsup.config.ts). It mirrors the `vm` API surface the
// engine's `runInVm` uses — `createContext(sandbox)` / `new Script(code)` /
// `script.runInContext(sandbox)` — but evaluates via `new Function` instead of a Node
// `vm` (which browsers lack). It lives in `src/` (not `scripts/`) because it is shipped
// *source* compiled into the browser bundle — like the other browser-safe shims
// (`assert.ts`, `singleton.ts`) — not a build-time tool you run.
//
// Decision (multi-target plan §4, "Option C"): the browser EVALUATES string `$where`
// rather than throwing — it just can't provide the `whereTimeout` sandbox, so it warns
// ONCE that it's running un-sandboxed. This is safe in the browser: the classic `vm`
// escape (`this.constructor.constructor('return process')()`) reaches nothing, because
// there is no `process`/`fs` in a browser — the browser IS the sandbox. `$where` stays
// "trusted-input-only" (never build a $where string from end-user input); the lost
// timeout means a `while(true)` string can hang the tab (a foot-gun, not a hole).
//
// The engine builds `code = '(' + fnSource + ').call(this.this)'` and runs it against
// a sandbox `{ this: doc, obj: doc }`. We reproduce that binding: `this` inside the
// evaluated code is the sandbox (so `this.this` is the doc), and the free variable
// `obj` resolves to the doc — matching how `vm` exposed the sandbox as global scope.

var warnedOnce = false;

function warnOnce(): void {
  if (warnedOnce) { return; }
  warnedOnce = true;
  // eslint-disable-next-line no-console
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      'micromongo: string $where runs via new Function in the browser build ' +
      '(no whereTimeout sandbox). Trusted-input only — never build a $where string ' +
      'from user input. Prefer $expr (no JS eval) where possible.'
    );
  }
}

function createContext(sandbox: any): any {
  // vm.createContext mutates `sandbox` into a context object; here it's a no-op —
  // we pass `sandbox` straight into runInContext. Return it to match the API.
  return sandbox;
}

function Script(this: any, code: string): any {
  if (!(this instanceof (Script as any))) { return new (Script as any)(code); }
  this.code = code;
}

// Evaluate `this.code` with `obj` in scope and `this` bound to the sandbox, so the
// engine's `(...).call(this.this)` resolves the document exactly as under `vm`.
Script.prototype.runInContext = function (sandbox: any): any {
  warnOnce();
  // `sandbox.obj` and `sandbox.this` are both the document (engine sets both).
  var fn = new Function('obj', 'return (' + this.code + ');');
  return fn.call(sandbox, sandbox.obj);
};

export = {
  createContext: createContext,
  Script: Script,
  runInContext: function (code: string, sandbox: any): any { return new (Script as any)(code).runInContext(sandbox); },
};
