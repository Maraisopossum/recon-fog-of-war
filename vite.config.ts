import { defineConfig } from 'vite';

export default defineConfig({
  // base relative : le site fonctionne dans un sous-dossier (GitHub Pages) comme à la racine
  base: './',
  server: { port: 5173 },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
