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
  build: demo ? { outDir: 'dist-demo', rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});
