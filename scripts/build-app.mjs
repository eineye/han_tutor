// Builds the student-only Android app into dist-app/ (Capacitor's webDir).
//   HANTUTOR_SERVER_URL=https://…  → talks to that class server (teacher screens stay on the server)
//   (not set)                       → trial app: works on its own, data stays on the phone
//   VITE_UPDATE_CHECK=apk           → shows "new version" notices (directly installed APKs only, never for Google Play)
import { execSync } from 'node:child_process';

const server = (process.env.HANTUTOR_SERVER_URL || '').trim().replace(/\/+$/, '');
if (server && !/^https:\/\//.test(server)) {
  console.error('HANTUTOR_SERVER_URL must start with https://');
  process.exit(1);
}
const env = { ...process.env, VITE_APP: '1' };
if (server) {
  env.VITE_API_BASE = server;
  delete env.VITE_DEMO;
} else {
  env.VITE_DEMO = '1';
}
execSync('npx vite build --outDir dist-app --emptyOutDir', { stdio: 'inherit', env });
console.log(`dist-app/ — ${server ? `class server ${server}` : 'trial app (no server)'}${env.VITE_UPDATE_CHECK === 'apk' ? ', update notices on' : ''}`);
