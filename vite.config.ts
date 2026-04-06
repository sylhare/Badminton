import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Badminton/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['@phosphor-icons/react'],
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