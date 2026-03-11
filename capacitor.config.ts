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

export default config;
