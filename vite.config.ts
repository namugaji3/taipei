import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' → 하위 경로(GitHub Pages 등)에 올려도 자료·리소스 경로가 깨지지 않습니다.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: { maplibre: ['maplibre-gl'], three: ['three'] },
      },
    },
  },
  test: { environment: 'node' },
} as never);
