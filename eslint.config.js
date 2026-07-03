'use strict';

// ESLint flat config (ESLint 9+/10). Replaces the legacy .eslintrc + .eslintignore.
//
// Faithful port of the previous .eslintrc: it extended NO shared "recommended"
// preset — only base ESLint defaults plus, for *.ts, the typescript-eslint parser
// and exactly two rules. (The codebase intentionally uses ES5-style `var`/function
// per CLAUDE.md conventions, so we must NOT pull in eslint:recommended /
// tseslint recommended, which would add no-var etc.)

var parser = require('@typescript-eslint/parser');
var tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  // Ignores (was .eslintignore).
  {
    ignores: [
      '**/node_modules/**',
      'coverage/**',
      'dist/**',
      'test-d/**',
    ],
  },

  // JS files: CommonJS with top-level `return` allowed (root index.js/cli.js shims,
  // require-dir loaders). No preset — matches the old bare config.
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      parserOptions: {
        ecmaFeatures: { globalReturn: true },
      },
    },
  },

  // .mjs / .mts are always ES modules (bundle smokes, the differential harness).
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },

  // TypeScript sources: typescript-eslint parser + the two project rules only.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: parser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': [
        'error',
        { allowArgumentsExplicitlyTypedAsAny: true },
      ],
    },
  },
];
