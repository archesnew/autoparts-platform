import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
export default defineConfig([
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@next/next": nextPlugin, next: nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs["core-web-vitals"].rules },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
