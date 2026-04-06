import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '', '');
  const base = env.VITE_APP_BASE_PATH || '/';

  return {
    plugins: [react()],
    base,
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2020',
    },
    test: {
      environment: 'node',
      globals: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
