import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages hosts this repository under /FREE-CROSSPOSTER/.
  // Local development and other hosts continue to use the root path.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/FREE-CROSSPOSTER/' : '/',
  plugins: [react()],
})
