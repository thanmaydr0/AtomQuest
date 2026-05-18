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
        manualChunks(id: string) {
          if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('zustand')) return 'vendor';
          if (id.includes('@supabase/supabase-js')) return 'supabase';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'forms';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
