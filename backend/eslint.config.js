const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Vitest runs with `globals: true` (vitest.config.mts), so the test files
    // use describe / it / expect / vi / beforeAll ... without importing them.
    // Some test files declare `const crypto = require('crypto')`, so the Node
    // global `crypto` is switched off here to avoid a no-redeclare error.
    files: ["tests/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
        crypto: "off",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
