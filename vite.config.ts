import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const demo = process.env.VITE_DEMO === '1';

/** Gives public/sw.js a new cache name on every build, so installed apps pick up the update. */
const swBuildId = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'sw-build-id',
    apply: 'build',
    configResolved: (c) => void (outDir = c.build.outDir),
    closeBundle() {
      const file = path.resolve(outDir, 'sw.js');
      if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('__BUILD_ID__', Date.now().toString(36)));
    },
  };
};

export default defineConfig({
  plugins: [react(), swBuildId()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  // Demo build: one self-contained JS bundle that scripts/inline-demo.mjs folds into a single HTML page
  // Target slightly older browsers too (iPhone Safari 14+, in-app browsers)
  build: {
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    ...(demo ? { outDir: 'dist-demo', assetsInlineLimit: 200_000, rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
  },
});
