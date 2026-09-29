import { defineConfig } from 'cypress';

// Testes E2E contra o back-end real (http://localhost:3000) e o front rodando em dev.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    setupNodeEvents(on, config) {
      return config;
    },
  },
  video: false,
  viewportWidth: 1280,
  viewportHeight: 800,
});
