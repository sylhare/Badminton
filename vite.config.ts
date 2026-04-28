import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
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