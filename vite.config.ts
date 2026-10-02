import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demo = process.env.VITE_DEMO === '1';

export default defineConfig({
  plugins: [react()],
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
