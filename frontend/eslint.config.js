import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Only the two long-stable rules — the rest of the plugin's "recommended"
      // set targets React Compiler readiness, which doesn't apply (React 18.3, no compiler).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Pre-existing `any` usage (dynamic table/exercise payloads); tightening
      // this is a typing project of its own, not a CI-hardening change.
      "@typescript-eslint/no-explicit-any": "off",
      // This codebase colocates helpers/hooks with the component that uses
      // them (shadcn-style UI files, TranslationCard, router.tsx) — real
      // module organisation, not something to split up for HMR purity.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // PronounDE/PronounEN intentionally reuse the same surface word across
    // different grammatical persons/cases (e.g. German "sie" = 3rd sg. fem.
    // AND 3rd pl.) — the duplication is the correct grammar, not a bug.
    files: ["src/ts/enums.ts"],
    rules: {
      "@typescript-eslint/no-duplicate-enum-values": "off",
    },
  },
);
