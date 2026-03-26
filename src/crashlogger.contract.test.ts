import { CrashLogger } from './backend/utils/CrashLogger';

describe('CrashLogger broken pipe policy', () => {
  test('treats write-side EPIPE and destroyed stream errors as ignorable process shutdown noise', () => {
    expect(
      CrashLogger.isIgnorableProcessWriteError(
        Object.assign(new Error('write EPIPE'), { code: 'EPIPE', syscall: 'write' })
      )
    ).toBe(true);
    expect(
      CrashLogger.isIgnorableProcessWriteError(
        Object.assign(new Error('stream destroyed'), { code: 'ERR_STREAM_DESTROYED' })
      )
    ).toBe(true);
  });

  test('does not suppress unrelated runtime exceptions', () => {
    expect(
      CrashLogger.isIgnorableProcessWriteError(
        Object.assign(new Error('permission denied'), { code: 'EACCES', syscall: 'open' })
      )
    ).toBe(false);
    expect(CrashLogger.isIgnorableProcessWriteError(new Error('boom'))).toBe(false);
  });
});
