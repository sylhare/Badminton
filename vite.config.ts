import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Badminton/' : '/',
  optimizeDeps: {
    include: ['tesseract.js'],
  },
  server: {
    watch: {
      ignored: ['**/analysis/**'],
    },
  },
  // Handle SPA routing - serve index.html for /analysis route
  appType: 'spa',
}));