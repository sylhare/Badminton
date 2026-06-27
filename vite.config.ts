import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import { copyTesseractAssets } from './script/copy-tesseract-assets';

function tesseractAssets(): Plugin {
  return {
    name: 'copy-tesseract-assets',
    configResolved() {
      copyTesseractAssets();
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tesseractAssets()],
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
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/analysis/**'],
    },
  },
  // Handle SPA routing - serve index.html for /analysis route
  appType: 'spa',
}));