import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import { fixupConfigRules } from "@eslint/compat";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  // Some upstream React rules still use context methods removed in ESLint 10.
  ...fixupConfigRules(nextVitals),
  // Next's Babel parser still supplies the older ESLint scope interface for JS.
  { files: ["**/*.{js,mjs,ts,tsx}"], languageOptions: { parser: tsParser } },
  globalIgnores([".next/**", "next-env.d.ts", "out/**", "build/**"]),
]);
