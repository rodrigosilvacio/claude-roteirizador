import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa permite publicar em qualquer subcaminho (ex.: GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
})
