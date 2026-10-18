import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // The API port comes from olap-app/.env so the proxy and the server always agree.
  const env = loadEnv(mode, '..', '');
  const apiPort = env.PORT || 3001;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
      },
    },
  };
});
