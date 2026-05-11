import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg', 'ink-landscape.svg'],
      manifest: {
        name: '墨迹任务面板',
        short_name: '任务面板',
        description: '个人待办、生日和大佬维护清单',
        theme_color: '#7d1f1f',
        background_color: '#f7f1e4',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
})
