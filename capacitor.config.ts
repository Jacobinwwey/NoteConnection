import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jacob.noteconnection.pro',
  appName: 'NoteConnection',
  webDir: 'dist/src/frontend',
  server: {
    hostname: 'localhost',
    cleartext: true,
    allowNavigation: ['localhost', '127.0.0.1'],
  },
};

if (process.env.NOTE_CONNECTION_MOBILE_WEB_DIR) {
  config.webDir = process.env.NOTE_CONNECTION_MOBILE_WEB_DIR;
}

export default config;
