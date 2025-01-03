import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./setup'],
    isolate: false,
    fileParallelism: false,
  },
});
