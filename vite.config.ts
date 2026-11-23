import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(),
      command === 'serve'
        ? {
            name: 'plugin-dev-healthcheck',
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                if (req.url === '/' || req.url === '/index.html') {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'text/html; charset=utf-8');
                  res.end(
                    '<!doctype html><html><body style="font-family:sans-serif;background:#0B0E11;color:#E6EDF3;padding:24px"><h1>sidelineos-plugin-video</h1><p>Library-Plugin-Repository (dist/index.js). Dev-Preview deaktiviert.</p></body></html>'
                  );
                  return;
                }
                next();
              });
            },
          }
        : null,
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
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
