import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js' },
  build: {
    outDir: 'dist', sourcemap: false, manifest: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/maplibre-gl/')) return 'maplibre-vendor';
          if (id.includes('/h3-js/') || id.includes('/supercluster/')) return 'geospatial-utils';
          return undefined;
        },
      },
    },
  },
});
