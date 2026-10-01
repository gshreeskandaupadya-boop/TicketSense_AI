import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy /api to the local Express backend.
// In prod, set VITE_API_URL (frontend/.env.local) to the deployed backend
// origin when the frontend is hosted separately from the API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Accept the sandbox preview host (and any proxy) for live preview.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
