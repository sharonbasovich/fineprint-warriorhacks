import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public/pdfjs", "qa/report"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } }
  },
  {
    files: ["qa/**/*.ts", "tools/**/*.ts", "tests/**/*.ts", "scripts/**/*.mjs", "*.ts", "*.js", "*.mts"],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
