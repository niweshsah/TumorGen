import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.TUMORGEN_API_URL || env.TUMORGEN_API_URL;
  return {
    plugins: [react(), tailwind()],
    server: {
      proxy: target ? { '/api': { target, changeOrigin: true } } : undefined,
    },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
