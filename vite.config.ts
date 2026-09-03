import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Every HTML entry point has to be listed, or only index.html is built.
      input: {
        main: 'index.html',
        about: 'about.html',
        aPropos: 'a-propos.html',
        privacy: 'privacy.html',
        confidentialite: 'confidentialite.html',
        legal: 'mentions-legales.html',
      },
    },
  },
});
