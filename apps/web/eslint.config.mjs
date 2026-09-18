import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * A leading underscore marks a parameter that is intentionally unused —
       * placeholders in mocked implementations whose signature is fixed by the
       * interface they satisfy. Naming them is clearer than dropping them.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * The Cloudflare Worker bundle, written by `@opennextjs/cloudflare`. It is
     * generated code from a dependency, not ours to style: linting it reports
     * `require()` imports and unused catch bindings we cannot fix and would not
     * want to, and one of them is an error rather than a warning, so a clean
     * tree fails `npm run lint` purely for having been built.
     */
    ".open-next/**",
    /*
     * Wrangler's own scratch bundles, written while previewing or deploying.
     * Same reasoning: generated, transient, and not ours.
     */
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
