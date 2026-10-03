#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');
const { sha256File } = require('./sidecar-build-fingerprint');

try {
  const args = process.argv.slice(2);
  const originalPatchelf = process.env.NOTE_CONNECTION_APPIMAGE_PATCHELF;
  const serverSuffix = process.env.NOTE_CONNECTION_APPIMAGE_SERVER_SUFFIX;
  const expectedSha256 = process.env.NOTE_CONNECTION_APPIMAGE_SERVER_SHA256;
  if (!originalPatchelf || !serverSuffix || !/^[a-f0-9]{64}$/.test(expectedSha256 || '')) {
    throw new Error('AppImage patchelf requires the Linux build runner environment');
  }

  if (args.length === 3 && args[0] === '--set-rpath' && path.resolve(args[2]).endsWith(`${path.sep}${serverSuffix}`)) {
    if (sha256File(args[2]) !== expectedSha256) {
      throw new Error(`Packaged server differs from the original pkg sidecar: ${args[2]}`);
    }
    // patchelf moves pkg's appended payload without updating its embedded offsets.
    // AppRun supplies LD_LIBRARY_PATH; linuxdeploy still discovers dependencies.
  } else {
    const command = spawnSync(originalPatchelf, args, { stdio: 'inherit' });
    if (command.error) throw command.error;
    if (command.signal) throw new Error(`patchelf terminated by ${command.signal}`);
    process.exitCode = command.status;
  }
} catch (error) {
  console.error(`[appimage-patchelf] ${error.message}`);
  process.exitCode = 1;
}
