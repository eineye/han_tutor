import type { CapacitorConfig } from '@capacitor/cli';

// Android app (한글온, students only). The web part is built by `npm run build:app` into dist-app/:
// with HANTUTOR_SERVER_URL it calls that class server's API, without it it is the self-contained trial app.
const config: CapacitorConfig = {
  appId: 'io.github.eineye.hangeulon',
  appName: '한글온',
  webDir: 'dist-app',
  backgroundColor: '#fff8f1',
  server: { androidScheme: 'https' },
  android: {
    allowMixedContent: false,
  },
};

export default config;
