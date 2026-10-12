import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: [".wxt/**", ".output/**", "node_modules/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        chrome: "readonly",
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        document: "readonly",
        window: "readonly",
        setTimeout: "readonly",
        Buffer: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
);
