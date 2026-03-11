const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyDetoxPipeline(repoRoot = path.resolve(__dirname, '..')) {
  const detoxConfigPath = path.join(repoRoot, '.detoxrc.json');
  const e2eJestConfigPath = path.join(repoRoot, 'e2e', 'jest.config.js');
  const e2eInitPath = path.join(repoRoot, 'e2e', 'init.js');
  const e2eSmokePath = path.join(repoRoot, 'e2e', 'smoke.e2e.js');
  const packageJsonPath = path.join(repoRoot, 'package.json');

  assert(fs.existsSync(detoxConfigPath), `Missing Detox config: ${detoxConfigPath}`);
  assert(fs.existsSync(e2eJestConfigPath), `Missing Detox Jest config: ${e2eJestConfigPath}`);
  assert(fs.existsSync(e2eInitPath), `Missing Detox init script: ${e2eInitPath}`);
  assert(fs.existsSync(e2eSmokePath), `Missing Detox smoke test: ${e2eSmokePath}`);

  const detoxConfig = readJson(detoxConfigPath);
  const packageJson = readJson(packageJsonPath);
  const scripts = packageJson.scripts || {};

  assert(detoxConfig.testRunner && detoxConfig.testRunner.args, 'Detox testRunner.args is required.');
  assert(detoxConfig.testRunner.args.config === 'e2e/jest.config.js', 'Detox testRunner must target e2e/jest.config.js.');
  assert(detoxConfig.apps && detoxConfig.apps['android.debug'], 'Detox android.debug app config is required.');
  assert(
    detoxConfig.apps['android.debug'].binaryPath === 'android/app/build/outputs/apk/debug/app-debug.apk',
    'Detox android.debug binaryPath must target the Capacitor debug APK output.'
  );
  assert(
    String(detoxConfig.apps['android.debug'].build || '').includes('mobile:build:capacitor'),
    'Detox android.debug build command must use mobile:build:capacitor.'
  );
  assert(detoxConfig.devices && detoxConfig.devices['android.emulator'], 'Detox android.emulator device config is required.');
  assert(
    detoxConfig.configurations && detoxConfig.configurations['android.emu.debug'],
    'Detox android.emu.debug configuration is required.'
  );

  assert(scripts['verify:detox:pipeline'] === 'node scripts/verify-detox-pipeline.js', 'Missing verify:detox:pipeline script.');
  assert(scripts['test:e2e:detox'] === 'node scripts/run-detox-e2e.js', 'Missing test:e2e:detox script.');
  assert(scripts['test:e2e:detox:run'] === 'node scripts/run-detox-e2e.js --run', 'Missing test:e2e:detox:run script.');

  return {
    configPath: detoxConfigPath,
    smokeTestPath: e2eSmokePath,
    packageJsonPath
  };
}

if (require.main === module) {
  try {
    const result = verifyDetoxPipeline();
    console.log(`[Detox Verify] Pipeline contract passed (${result.configPath}).`);
  } catch (error) {
    console.error(`[Detox Verify] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  verifyDetoxPipeline
};
