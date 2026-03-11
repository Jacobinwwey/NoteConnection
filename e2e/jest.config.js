module.exports = {
  rootDir: '..',
  testRunner: 'jest-circus/runner',
  testTimeout: 120000,
  testMatch: ['<rootDir>/e2e/**/*.e2e.js'],
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
  verbose: true
};
