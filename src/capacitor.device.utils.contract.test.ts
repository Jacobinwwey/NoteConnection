import * as path from 'path';

describe('capacitor device utility contracts', () => {
  const utilsPath = path.resolve(__dirname, '..', 'scripts', 'capacitor-device-utils.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const utils = require(utilsPath) as {
    isTruthy: (value: unknown) => boolean;
    buildAdbCandidates: () => string[];
    parseAdbDevicesOutput: (text: string) => Array<{ serial: string; status: string; raw: string }>;
    getOnlineDevices: (devices: Array<{ serial: string; status: string }>) => Array<{ serial: string; status: string }>;
    summarizeDeviceStates: (devices: Array<{ serial: string; status: string }>) => Record<string, number>;
    formatDeviceStateSummary: (devices: Array<{ serial: string; status: string }>) => string;
    classifyDeviceRuntime: (
      serial: string,
      runtime: Record<string, string>
    ) => { likelyEmulator: boolean; reasons: string[] };
  };

  test('parses adb device output with mixed states', () => {
    const devices = utils.parseAdbDevicesOutput([
      'List of devices attached',
      'emulator-5554\tdevice product:sdk_gphone_x86',
      'R58M123ABC\tunauthorized',
      '10.0.0.18:5555\toffline',
      '',
    ].join('\n'));

    expect(devices).toEqual([
      expect.objectContaining({ serial: 'emulator-5554', status: 'device' }),
      expect.objectContaining({ serial: 'R58M123ABC', status: 'unauthorized' }),
      expect.objectContaining({ serial: '10.0.0.18:5555', status: 'offline' }),
    ]);
  });

  test('filters online devices and summarizes states', () => {
    const devices = [
      { serial: 'a', status: 'device', raw: 'a\tdevice' },
      { serial: 'b', status: 'unauthorized', raw: 'b\tunauthorized' },
      { serial: 'c', status: 'device', raw: 'c\tdevice' },
      { serial: 'd', status: 'offline', raw: 'd\toffline' },
    ];

    const online = utils.getOnlineDevices(devices);
    expect(online).toHaveLength(2);
    expect(online.map((entry) => entry.serial)).toEqual(['a', 'c']);

    expect(utils.summarizeDeviceStates(devices)).toEqual({
      device: 2,
      unauthorized: 1,
      offline: 1,
    });
    expect(utils.formatDeviceStateSummary(devices)).toBe('device:2, offline:1, unauthorized:1');
  });

  test('builds adb command candidates from env overrides', () => {
    const prevAdbPath = process.env.ADB_PATH;
    const prevSdkRoot = process.env.ANDROID_SDK_ROOT;

    process.env.ADB_PATH = 'D:\\tools\\adb\\adb.exe';
    process.env.ANDROID_SDK_ROOT = 'D:\\Android\\Sdk';
    const candidates = utils.buildAdbCandidates();

    if (typeof prevAdbPath === 'undefined') {
      delete process.env.ADB_PATH;
    } else {
      process.env.ADB_PATH = prevAdbPath;
    }
    if (typeof prevSdkRoot === 'undefined') {
      delete process.env.ANDROID_SDK_ROOT;
    } else {
      process.env.ANDROID_SDK_ROOT = prevSdkRoot;
    }

    expect(candidates[0]).toBe('D:\\tools\\adb\\adb.exe');
    expect(candidates).toContain(path.join('D:\\Android\\Sdk', 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'));
    expect(candidates).toContain('adb');
  });

  test('classifies emulator-like runtime fingerprints and truthy flags', () => {
    expect(utils.isTruthy('1')).toBe(true);
    expect(utils.isTruthy('true')).toBe(true);
    expect(utils.isTruthy('no')).toBe(false);

    const emulator = utils.classifyDeviceRuntime('emulator-5554', {
      roKernelQemu: '1',
      model: 'sdk_gphone64_x86_64',
      manufacturer: 'Google',
      brand: 'generic',
      product: 'sdk_gphone64_x86_64',
      device: 'generic_x86_64',
      hardware: 'ranchu',
      fingerprint: 'google/sdk_gphone64_x86_64/generic_x86_64',
    });
    expect(emulator.likelyEmulator).toBe(true);
    expect(emulator.reasons.length).toBeGreaterThan(0);

    const physical = utils.classifyDeviceRuntime('R58M123ABC', {
      roKernelQemu: '0',
      model: 'SM-S911B',
      manufacturer: 'samsung',
      brand: 'samsung',
      product: 'dm1qxeea',
      device: 'dm1q',
      hardware: 'qcom',
      fingerprint: 'samsung/dm1qxx/dm1q:14/UP1A.231005.007/S911BXXU3BWJM:user/release-keys',
    });
    expect(physical.likelyEmulator).toBe(false);
    expect(physical.reasons).toEqual([]);
  });
});
