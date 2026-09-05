/**
 * Metro, taught about the monorepo.
 *
 * npm hoists most dependencies to the workspace root, so Metro has to watch two
 * places and resolve from two `node_modules` trees. Without this it bundles from
 * `apps/mobile/node_modules` alone, finds almost nothing, and fails with module
 * errors that point at the wrong problem.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
