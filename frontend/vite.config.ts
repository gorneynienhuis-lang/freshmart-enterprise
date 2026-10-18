import { defineConfig } from 'vite';
export default defineConfig({ server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false }, '/catalog': { target: 'http://127.0.0.1:8080' }, '/static': { target: 'http://127.0.0.1:8080' } } }, preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
