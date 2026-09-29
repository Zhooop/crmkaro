const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const realMonorepoRoot = fs.existsSync(monorepoRoot) ? fs.realpathSync(monorepoRoot) : monorepoRoot;
const realProjectRoot = fs.existsSync(projectRoot) ? fs.realpathSync(projectRoot) : projectRoot;

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (include both casing variants and node_modules)
config.watchFolders = [
  monorepoRoot,
  realMonorepoRoot,
  path.resolve(realMonorepoRoot, "node_modules"),
  path.resolve(realMonorepoRoot, "node_modules/.pnpm"),
  path.resolve(realProjectRoot, "node_modules"),
];

// 2. Let Metro know where to resolve packages in a PNPM monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(realProjectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(realMonorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// 3. Rewrite requests for monorepo root
config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    if (url.startsWith("/index") || url.startsWith("/.expo/")) {
      return "/apps/mobile" + url;
    }
    return url;
  },
};

module.exports = config;
