import { defineConfig } from 'vite';
import { resolve } from 'node:path';
// Two pages: the main app (The Bulge, home) and the Golan '73 hot-seat table. golan-sheet.html is a dev-only page and is not built.
export default defineConfig({ base: './', server: { fs: { allow: ['..'] } }, build: { target: 'es2022', rollupOptions: { input: { main: resolve(__dirname, 'index.html'), golan: resolve(__dirname, 'golan.html') } } } });
