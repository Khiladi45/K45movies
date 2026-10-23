const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// cheerio's exports map offers a "browser" condition, but Metro's default
// conditionNames omit it and fall through to the ESM build, which imports
// node:stream and fails to resolve. Providers only ever call cheerio.load(),
// which the browser build provides.
const CHEERIO_BROWSER = path.resolve(
  __dirname,
  "node_modules/cheerio/dist/browser/index.js",
);
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const request = moduleName === "cheerio" ? CHEERIO_BROWSER : moduleName;
  return resolveRequest
    ? resolveRequest(context, request, platform)
    : context.resolveRequest(context, request, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
