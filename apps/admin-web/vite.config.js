import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  // Lee el .env / .env.local de la RAÍZ del monorepo (mismas variables que
  // usaba el panel Next.js: NEXT_PUBLIC_FIREBASE_*).
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    port: 5173,
    // Falla en vez de cambiar de puerto silenciosamente (evita confundir
    // tests y entornos con instancias huérfanas).
    strictPort: true,
    // Proxy hacia la Admin API (Express) para no tener CORS en desarrollo.
    // El destino se puede cambiar con VITE_API_PROXY_TARGET (lo usan los tests).
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Divide los vendors pesados en chunks independientes para
        // mejorar el cacheo del navegador.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@googlemaps')) return 'google-maps'
          if (id.includes('@firebase/firestore')) return 'firebase-firestore'
          if (id.includes('@firebase/auth')) return 'firebase-auth'
          if (id.includes('node_modules/firebase/')) return 'firebase-compat'
          if (id.includes('@firebase/')) return 'firebase-core'
          if (id.includes('protobufjs')) return 'protobuf'
          if (id.includes('lucide-vue-next')) return 'icons'
          if (id.includes('/vue/') || id.includes('vue-router') || id.includes('/pinia/')) {
            return 'vue'
          }
          return 'vendor'
        },
      },
    },
  },
})


