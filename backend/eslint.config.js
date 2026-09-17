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
        ...globals.jest,
      },
    },
  },
  {
    // jest-environment-node@27 (this project's Jest version, from 2022)
    // builds its sandboxed global scope from an older Node global list that
    // predates globalThis.crypto — unlike real Node 24 runtime code, test
    // files genuinely don't have a global `crypto` and must require() it.
    files: ["tests/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
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
