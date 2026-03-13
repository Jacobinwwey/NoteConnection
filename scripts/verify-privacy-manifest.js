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
const REQUIRED_TRACKING_USAGE_DESCRIPTION_KEY = 'NSUserTrackingUsageDescription';
const MIN_TRACKING_USAGE_DESCRIPTION_LENGTH = 16;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractPlistStringValue(xml, key) {
  const keyPattern = new RegExp(
    `<key>\\s*${escapeForRegex(key)}\\s*<\\/key>\\s*<string>([\\s\\S]*?)<\\/string>`,
    'i'
  );
  const match = keyPattern.exec(xml);
  if (!match || typeof match[1] !== 'string') {
    return '';
  }
  return match[1].trim();
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

  const infoPlistPath = path.join(repoRoot, 'ios', 'App', 'Info.plist');
  assert(fs.existsSync(infoPlistPath), `Missing iOS Info.plist: ${infoPlistPath}`);
  const infoPlistXml = fs.readFileSync(infoPlistPath, 'utf8');
  const trackingUsageDescription = extractPlistStringValue(
    infoPlistXml,
    REQUIRED_TRACKING_USAGE_DESCRIPTION_KEY
  );
  assert(
    trackingUsageDescription.length >= MIN_TRACKING_USAGE_DESCRIPTION_LENGTH,
    `Info.plist must provide ${REQUIRED_TRACKING_USAGE_DESCRIPTION_KEY} with descriptive non-empty text.`
  );

  return {
    manifestPath,
    requiredEntries: REQUIRED_ACCESS_API_TYPES.length,
    infoPlistPath
  };
}

if (require.main === module) {
  try {
    const result = verifyPrivacyManifest();
    console.log(
      `[Privacy Verify] Manifest contract passed (${result.requiredEntries} required-reason API entries): ${result.manifestPath}`
    );
    console.log(
      `[Privacy Verify] Info.plist tracking usage description present: ${result.infoPlistPath}`
    );
  } catch (error) {
    console.error(`[Privacy Verify] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  verifyPrivacyManifest
};
