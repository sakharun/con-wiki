import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  // В production по умолчанию публикуем в /con-wiki/ (GitHub Pages).
  // Dev остаётся на корне, CI может переопределить путь через VITE_BASE.
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/con-wiki/' : '/'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared/', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          graph: ['d3-force'],
        },
      },
    },
  },
}))
