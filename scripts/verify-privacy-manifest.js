const fs = require('fs');
const path = require('path');

const REQUIRED_ACCESS_API_TYPES = [
  {
    category: 'NSPrivacyAccessedAPICategoryFileTimestamp',
    reason: 'C617.1'
  },
  {
    category: 'NSPrivacyAccessedAPICategoryDiskSpace',
    reason: 'E174.1'
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function verifyPrivacyManifest(repoRoot = path.resolve(__dirname, '..')) {
  const manifestPath = path.join(repoRoot, 'ios', 'App', 'PrivacyInfo.xcprivacy');
  assert(fs.existsSync(manifestPath), `Missing privacy manifest: ${manifestPath}`);
  const xml = fs.readFileSync(manifestPath, 'utf8');

  assert(xml.includes('<key>NSPrivacyTracking</key>'), 'Privacy manifest must declare NSPrivacyTracking.');
  assert(xml.includes('<key>NSPrivacyCollectedDataTypes</key>'), 'Privacy manifest must declare NSPrivacyCollectedDataTypes.');
  assert(xml.includes('<key>NSPrivacyAccessedAPITypes</key>'), 'Privacy manifest must declare NSPrivacyAccessedAPITypes.');

  REQUIRED_ACCESS_API_TYPES.forEach((entry) => {
    const categoryPattern = new RegExp(`<string>${escapeForRegex(entry.category)}</string>`);
    const reasonPattern = new RegExp(`<string>${escapeForRegex(entry.reason)}</string>`);
    assert(categoryPattern.test(xml), `Privacy manifest missing required API category: ${entry.category}`);
    assert(reasonPattern.test(xml), `Privacy manifest missing required reason code ${entry.reason} for ${entry.category}`);
  });

  return {
    manifestPath,
    requiredEntries: REQUIRED_ACCESS_API_TYPES.length
  };
}

if (require.main === module) {
  try {
    const result = verifyPrivacyManifest();
    console.log(
      `[Privacy Verify] Manifest contract passed (${result.requiredEntries} required-reason API entries): ${result.manifestPath}`
    );
  } catch (error) {
    console.error(`[Privacy Verify] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  verifyPrivacyManifest
};
