import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Every HTML entry point has to be listed, or only index.html is built.
      input: {
        main: 'index.html',
        about: 'about.html',
        privacy: 'privacy.html',
        legal: 'mentions-legales.html',
      },
    },
  },
});
