import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: './', server: { host: '127.0.0.1' }, build: { rollupOptions: { output: { manualChunks(id) { if (id.endsWith('/src/source-index.json')) return 'source-index'; if (id.includes('/node_modules/') && !id.includes('/prismjs/')) return 'vendor'; } } } } });
