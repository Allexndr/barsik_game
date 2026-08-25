import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import path from 'path';

/** Serve public/model-gallery/index.html for /model-gallery (SPA fallback would steal it). */
function publicGalleryIndex(): Plugin {
  return {
    name: 'public-gallery-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url === '/model-gallery' || url === '/model-gallery/') {
          req.url = '/model-gallery/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [publicGalleryIndex(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8765,
    open: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', 'zustand'],
  },
});
