import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

import { copyTesseractAssets } from './script/copy-tesseract-assets.ts';
import { yamlPlugin } from './vite/yamlPlugin.ts';

function tesseractAssets(): Plugin {
  return {
    name: 'copy-tesseract-assets',
    configResolved() {
      copyTesseractAssets();
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    yamlPlugin(),
    react(),
    tesseractAssets(),
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  base: command === 'build' ? '/Badminton/' : '/',
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@phosphor-icons/react')) {
            return 'vendor-icons';
          }
          if (id.includes('/src/tournament/')) {
            return 'tournament-core';
          }
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/analysis/**'],
    },
  },
  appType: 'spa',
}));
