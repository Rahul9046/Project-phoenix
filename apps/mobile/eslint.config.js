// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // `dist` is build output. `.expo` is generated -- the typed-routes file in
    // particular carries its own eslint-disable directive, which this config
    // then reports as unused; linting either is noise about code nobody wrote.
    ignores: ["dist/*", ".expo/*", "expo-env.d.ts"],
  },
]);
