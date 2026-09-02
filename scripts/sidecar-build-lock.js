'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_STALE_MS = 15 * 60 * 1000;
const DEFAULT_POLL_MS = 250;

function positiveNumber(value, fallback, minimum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function isProcessAlive(pid) {
  const normalizedPid = Number(pid);
  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) {
    return false;
  }
  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function readLockRecord(lockPath) {
  try {
    const content = fs.readFileSync(lockPath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function lockAgeMs(lockPath, record) {
  let fileMtimeMs = 0;
  try {
    fileMtimeMs = fs.statSync(lockPath).mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
  const startedAtMs = Date.parse(String(record && record.startedAt || ''));
  const referenceMs = Number.isFinite(startedAtMs) ? startedAtMs : fileMtimeMs;
  return Math.max(0, Date.now() - Math.max(fileMtimeMs, referenceMs));
}

function isStaleLock(lockPath, record, staleMs) {
  if (lockAgeMs(lockPath, record) < staleMs) {
    return false;
  }
  const ownerHostname = String(record && record.hostname || '').trim();
  if (ownerHostname && ownerHostname !== os.hostname()) {
    return true;
  }
  const ownerPid = Number(record && record.pid);
  return !isProcessAlive(ownerPid);
}

function sleepSync(milliseconds) {
  const durationMs = Math.max(1, Math.floor(milliseconds));
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(waitBuffer, 0, 0, durationMs);
}

function describeOwner(record) {
  if (!record || typeof record !== 'object') {
    return 'owner=unknown';
  }
  return [
    `pid=${String(record.pid || 'unknown')}`,
    `host=${String(record.hostname || 'unknown')}`,
    `startedAt=${String(record.startedAt || 'unknown')}`,
  ].join(', ');
}

function acquireSidecarBuildLock(lockPath, options = {}) {
  const rawLockPath = String(lockPath || '').trim();
  if (!rawLockPath) {
    throw new Error('A concrete sidecar build lock path is required.');
  }
  const resolvedPath = path.resolve(rawLockPath);
  if (resolvedPath === path.parse(resolvedPath).root) {
    throw new Error('A concrete sidecar build lock path is required.');
  }

  const timeoutMs = positiveNumber(options.timeoutMs, positiveNumber(
    process.env.NOTE_CONNECTION_SIDECAR_LOCK_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    1
  ), 1);
  const staleMs = positiveNumber(options.staleMs, positiveNumber(
    process.env.NOTE_CONNECTION_SIDECAR_LOCK_STALE_MS,
    DEFAULT_STALE_MS,
    1
  ), 1);
  const pollMs = positiveNumber(options.pollMs, positiveNumber(
    process.env.NOTE_CONNECTION_SIDECAR_LOCK_POLL_MS,
    DEFAULT_POLL_MS,
    1
  ), 1);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const token = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const ownerRecord = {
    pid: process.pid,
    hostname: os.hostname(),
    startedAt,
    command: process.argv.slice(0, 4).join(' '),
    token,
  };
  const waitStartedAt = Date.now();
  let lastOwner = null;

  while (true) {
    let descriptor = null;
    let createdLockFile = false;
    try {
      descriptor = fs.openSync(resolvedPath, 'wx');
      createdLockFile = true;
      fs.writeFileSync(descriptor, `${JSON.stringify(ownerRecord)}\n`, 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      let released = false;
      return {
        lockPath: resolvedPath,
        owner: { ...ownerRecord },
        release() {
          if (released) {
            return;
          }
          released = true;
          try {
            const current = readLockRecord(resolvedPath);
            if (!current || current.token !== token) {
              return;
            }
            fs.unlinkSync(resolvedPath);
          } catch (error) {
            if (!error || error.code !== 'ENOENT') {
              throw error;
            }
          }
        },
      };
    } catch (error) {
      if (descriptor !== null) {
        try { fs.closeSync(descriptor); } catch { }
      }
      if (createdLockFile) {
        try {
          const current = readLockRecord(resolvedPath);
          if (!current || current.token === token) {
            fs.unlinkSync(resolvedPath);
          }
        } catch (cleanupError) {
          if (!cleanupError || cleanupError.code !== 'ENOENT') {
            throw cleanupError;
          }
        }
      }
      if (!error || error.code !== 'EEXIST') {
        throw error;
      }

      lastOwner = readLockRecord(resolvedPath);
      if (isStaleLock(resolvedPath, lastOwner, staleMs)) {
        try {
          fs.unlinkSync(resolvedPath);
          continue;
        } catch (unlinkError) {
          if (unlinkError && unlinkError.code === 'ENOENT') {
            continue;
          }
        }
      }

      if (Date.now() - waitStartedAt >= timeoutMs) {
        throw new Error(
          `Timed out waiting for sidecar build lock after ${timeoutMs} ms (${describeOwner(lastOwner)}).`
        );
      }
      sleepSync(pollMs);
    }
  }
}

module.exports = {
  acquireSidecarBuildLock,
  isProcessAlive,
  readLockRecord,
};
