import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/FiveStar/', // <--- THIS LINE IS CRITICAL. MUST MATCH YOUR REPO NAME.
})
