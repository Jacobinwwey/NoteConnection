const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  // Only run source tests; compiled dist tests are build artifacts and can resolve paths incorrectly.
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/ref/"],
};
