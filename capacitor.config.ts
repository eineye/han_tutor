import type { CapacitorConfig } from '@capacitor/cli';

// Android app (한글온). Two modes:
// - default: the self-contained app (dist-demo/site) is packed into the APK — works offline, data stays on the phone
// - HANTUTOR_SERVER_URL=https://… : the app opens the class server (teacher dashboard, shared progress, AI)
const serverUrl = process.env.HANTUTOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'io.github.eineye.hangeulon',
  appName: '한글온',
  webDir: 'dist-demo/site',
  backgroundColor: '#fff8f1',
  server: serverUrl ? { url: serverUrl, cleartext: false } : { androidScheme: 'https' },
  android: {
    allowMixedContent: false,
  },
};

export default config;
