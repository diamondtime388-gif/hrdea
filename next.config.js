const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client"],
  webpack: (config) => {
    // libsodium-wrappers-sumo's package.json only exports its ESM entry
    // point, which webpack can't statically follow (it does a runtime
    // dynamic import of a wasm loader). Point straight at the absolute
    // path of the CommonJS build instead, bypassing the exports map.
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers-sumo$": path.resolve(
        __dirname,
        "node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js"
      ),
    };
    return config;
  },
};

module.exports = nextConfig;
