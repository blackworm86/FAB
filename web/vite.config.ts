import { defineConfig } from 'vite';
import { resolve } from 'node:path';
// One page runs every game (the volume is chosen by ?game=). golan-sheet.html is a dev-only page and is not built.
export default defineConfig({
  base: './',
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022', rollupOptions: { input: { main: resolve(__dirname, 'index.html') } } },
});
