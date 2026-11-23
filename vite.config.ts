import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/index.tsx'),
        formats: ['es'],
        fileName: 'index',
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime', '@sidelineos/plugin-sdk'],
      },
      sourcemap: true,
      emptyOutDir: true,
    },
  };
});
