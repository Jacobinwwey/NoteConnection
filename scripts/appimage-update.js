const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { productName } = require('../src-tauri/tauri.conf.json');

const APPIMAGE_SUFFIX = '_amd64.AppImage';
const APPIMAGE_UPDATE_INFORMATION = `gh-releases-zsync|Jacobinwwey|NoteConnection|latest|${productName}_*${APPIMAGE_SUFFIX}.zsync`;

function verifyAppImageUpdate(artifact) {
  const filename = path.basename(artifact);
  if (!filename.startsWith(`${productName}_`) || !filename.endsWith(APPIMAGE_SUFFIX)) {
    throw new Error('AppImage update assets must use the supported product amd64 filename');
  }
  const updateInformation = execFileSync(artifact, ['--appimage-updateinformation'], {
    encoding: 'utf8', timeout: 30000,
  }).trim();
  if (updateInformation !== APPIMAGE_UPDATE_INFORMATION) {
    throw new Error(`AppImage update information must be ${APPIMAGE_UPDATE_INFORMATION}`);
  }

  const zsyncPath = `${artifact}.zsync`;
  const control = fs.readFileSync(zsyncPath);
  const headerEnd = control.indexOf('\n\n');
  if (headerEnd < 0) throw new Error('zsync header is missing its checksum table separator');
  const fields = new Map();
  const allowedFields = new Set(['zsync', 'Filename', 'MTime', 'Blocksize', 'Length', 'Hash-Lengths', 'URL', 'SHA-1']);
  for (const line of control.subarray(0, headerEnd).toString('latin1').split('\n')) {
    const match = line.match(/^([A-Za-z0-9-]+): (.+)$/);
    if (!match || !allowedFields.has(match[1]) || fields.has(match[1]) || !/^[\x20-\x7e]+$/.test(match[2])) {
      throw new Error('zsync header contains a malformed, unsupported or duplicate field');
    }
    fields.set(match[1], match[2]);
  }
  if (!/^0\.6\.\d+$/.test(fields.get('zsync') || '')) throw new Error('Unsupported zsync format version');
  if (fields.get('Filename') !== filename || fields.get('URL') !== filename) {
    throw new Error('zsync Filename and relative URL must name the adjacent AppImage');
  }
  const length = Number(fields.get('Length'));
  if (!/^[1-9]\d*$/.test(fields.get('Length') || '') || !Number.isSafeInteger(length)
      || length !== fs.statSync(artifact).size) {
    throw new Error('zsync Length does not match the final AppImage');
  }
  const blocksize = Number(fields.get('Blocksize'));
  if (!/^[1-9]\d*$/.test(fields.get('Blocksize') || '') || !Number.isSafeInteger(blocksize)
      || 2 ** Math.round(Math.log2(blocksize)) !== blocksize) {
    throw new Error('zsync Blocksize must be a positive power of two');
  }
  const hashLengths = (fields.get('Hash-Lengths') || '').match(/^([12]),([1-4]),([3-9]|1[0-6])$/);
  if (!hashLengths) throw new Error('zsync Hash-Lengths are outside the supported format bounds');
  // The first field is the sequence-match count, not bytes stored in each table entry.
  const tableLength = Math.ceil(length / blocksize) * (Number(hashLengths[2]) + Number(hashLengths[3]));
  if (control.length - headerEnd - 2 !== tableLength) {
    throw new Error('zsync checksum table has an invalid length');
  }
  // Coreutils streams the large image; do not retain a second complete AppImage in memory.
  const sha1 = execFileSync('sha1sum', ['--', artifact], { encoding: 'utf8', timeout: 120000 }).slice(0, 40);
  if (!/^[a-f0-9]{40}$/.test(fields.get('SHA-1') || '') || fields.get('SHA-1') !== sha1) {
    throw new Error('zsync SHA-1 does not match the final AppImage');
  }
  return { updateInformation, zsyncPath, sha1 };
}

module.exports = { APPIMAGE_UPDATE_INFORMATION, verifyAppImageUpdate };
