import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Site multi-pages dans src/ ; GitHub Pages : BASE_PATH=/<dépôt>/
export default defineConfig({
  root: 'src',
  base: process.env.BASE_PATH ?? './',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // tout en fichiers (drapeaux, polices) : pas de données en base64 dans les scripts
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'src/index.html'),
        ecriture: resolve(import.meta.dirname, 'src/ecriture.html'),
        formes: resolve(import.meta.dirname, 'src/formes.html'),
        labyrinthe: resolve(import.meta.dirname, 'src/labyrinthe.html'),
        lecture: resolve(import.meta.dirname, 'src/lecture.html'),
        carte: resolve(import.meta.dirname, 'src/carte.html'),
      },
    },
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
  },
});
