import { defineConfig } from 'vite';

// The playable build is written to docs/ so GitHub Pages can serve it (main branch, /docs folder).
// - base './'            : works under /dustfall-ko/ or any sub-path
// - assetsDir 'bundle'   : keeps docs/assets/ for the copied public/assets (models, textures, CREDITS.txt)
// - emptyOutDir false    : docs/ also holds the README screenshots
// - hashCharacters 'hex' : lowercase hashed file names (web upload on GitHub lowercases names)
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  build: {
    outDir: 'docs',
    emptyOutDir: false,
    assetsDir: 'bundle',
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { hashCharacters: 'hex' } },
  },
}));
