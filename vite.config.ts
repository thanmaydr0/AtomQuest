import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: React core + router + state management
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          // Supabase client
          supabase: ['@supabase/supabase-js'],
          // Charts (heavy, lazy-loadable)
          charts: ['recharts'],
          // Form handling
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
