import { defineConfig } from "eslint/config";
import tseslint from "@electron-toolkit/eslint-config-ts";
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier";
import eslintPluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let autoImportGlobals = {};
try {
  autoImportGlobals = require("./frontend/.eslintrc-auto-import.json").globals;
} catch {
  // file not yet generated, run dev once to generate it
}

export default defineConfig(
  { ignores: ["**/node_modules", "**/dist", "**/out", "**/data"] },
  tseslint.configs.recommended,
  eslintPluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        extraFileExtensions: [".vue"],
        parser: tseslint.parser,
      },
      globals: autoImportGlobals,
    },
  },
  {
    files: ["**/*.{ts,mts,tsx,vue}"],
    rules: {
      "vue/require-default-prop": "off",
      "vue/multi-word-component-names": "off",
      "vue/block-lang": [
        "error",
        {
          script: {
            lang: "ts",
          },
        },
      ],
    },
  },

  // --- Main-process layering guard ----------------------------------------
  // Enforces dependency direction inside electron/main/:
  //   ipc/      -> services/ only (plus shared + _kit)
  //   services/ -> domain/ + infra/
  //   domain/   -> shared only (no electron / services / infra)
  //   infra/    -> shared + npm (no services / domain / ipc)
  {
    files: ["electron/main/domain/**/*.ts"],
    // These domain files predate the layering guard and pull fs / infra
    // helpers for now. They will be split further in a future change;
    // the rule remains enforced for all other domain modules.
    ignores: [
      "electron/main/domain/acp/detector.ts",
      "electron/main/domain/integration/yunxiao/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["electron", "electron/*"],
              message: "domain/ must not depend on Electron APIs",
            },
            {
              group: ["@electron-toolkit/*"],
              message: "domain/ must not depend on Electron toolkit",
            },
            {
              group: ["@main/services/*"],
              message: "domain/ must not depend on services/",
            },
            {
              group: ["@main/infra/*"],
              message: "domain/ must not depend on infra/",
            },
            {
              group: ["@main/ipc/*"],
              message: "domain/ must not depend on ipc/",
            },
            {
              group: ["@main/bootstrap/*"],
              message: "domain/ must not depend on bootstrap/",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["electron/main/ipc/**/*.ts"],
    ignores: ["electron/main/ipc/_kit/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // infra/logger is cross-cutting and exempt; everything else in infra
              // must be accessed through a service.
              group: ["@main/infra/!(logger)", "@main/infra/!(logger)/**"],
              message: "ipc/ handlers must go through services/ (logger is the only exception)",
              allowTypeImports: true,
            },
            {
              group: ["@main/domain/*"],
              message: "ipc/ handlers must go through services/",
              allowTypeImports: true,
            },
            {
              group: ["fs", "fs/*", "node:fs", "node:fs/*"],
              message: "ipc/ must not touch fs directly",
            },
            {
              group: ["child_process", "node:child_process"],
              message: "ipc/ must not spawn processes directly",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["electron/main/infra/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@main/services/*"],
              message: "infra/ must not depend on services/",
            },
            {
              group: ["@main/ipc/*"],
              message: "infra/ must not depend on ipc/",
            },
            // infra IS allowed to use domain pure helpers — domain is "knowledge"
            // and infra is "capability"; capabilities using knowledge is fine.
          ],
        },
      ],
    },
  },

  eslintConfigPrettier
);
