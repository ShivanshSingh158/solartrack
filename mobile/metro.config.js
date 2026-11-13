// metro.config.js — Fixes Metro's inability to follow Windows directory junctions
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// Resolve the real path if this directory is a junction/symlink
// so Metro can always find modules regardless of how it was started
const realDir = fs.realpathSync(__dirname);
if (realDir !== __dirname) {
  config.watchFolders = [realDir, ...(config.watchFolders || [])];
  config.resolver = config.resolver || {};
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
  };
}

// Ensure Metro always uses the real path as the project root
config.projectRoot = realDir;

module.exports = config;
