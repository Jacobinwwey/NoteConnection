const fs = require('fs');
const runtime = require('../config/godot-desktop-runtime.json');

function writeGodotDesktopCiEnvironment(destination) {
  if (!destination) throw new Error('GITHUB_ENV is required to export the desktop Godot runtime contract.');
  const entries = {
    GODOT_MIRROR_TAG: runtime.mirrorTag,
    GODOT_UPSTREAM_BASE_URL: runtime.upstreamBaseUrl,
  };
  for (const [platform, archive] of Object.entries(runtime.archives)) {
    entries[`GODOT_${platform.toUpperCase()}_ARCHIVE_NAME`] = archive.name;
    entries[`GODOT_${platform.toUpperCase()}_ARCHIVE_SHA256`] = archive.sha256;
  }
  fs.appendFileSync(destination, Object.entries(entries).map(([key, value]) => `${key}=${value}\n`).join(''));
}

if (require.main === module) writeGodotDesktopCiEnvironment(process.env.GITHUB_ENV);
module.exports = { writeGodotDesktopCiEnvironment };
