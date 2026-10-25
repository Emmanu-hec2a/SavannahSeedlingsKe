import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Preserve the Vite 5 browser baseline while upgrading the build tooling.
  build: { target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'] },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
})
