import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Starts one in-memory MongoDB replica set for the whole run
    globalSetup: ['tests/setup/globalSetup.ts'],
    // Sets env vars + a per-file database before any app module is imported
    setupFiles: ['tests/setup/env.ts'],
    // First run downloads the MongoDB binary used by mongodb-memory-server
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
