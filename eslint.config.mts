import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "dist",
    "coverage",
    "main.js",
    "esbuild.config.mjs",
    "scripts",
    "manifest.json",
    "versions.json",
    "package.json",
    "package-lock.json"
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts"]
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }]
    }
  },
  ...obsidianmd.configs.recommended
);
