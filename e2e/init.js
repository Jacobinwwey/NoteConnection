const detox = require('detox');
const configuration = require('../.detoxrc.json');

jest.setTimeout(120000);

beforeAll(async () => {
  await detox.init(configuration, { launchApp: false });
});

afterAll(async () => {
  await detox.cleanup();
});

beforeEach(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: { notifications: 'YES' }
  });
});
