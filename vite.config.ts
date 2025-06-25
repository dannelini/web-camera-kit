import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Web Camera Kit',
        short_name: 'Web Camera Kit', 
        description: 'A lightweight, mobile-optimized camera boilerplate for AI and computer vision projects',
        theme_color: '#1f2937',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-image.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-image.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-image.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});