import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./file-setup'],
    server: {
      deps: {
        // try to force setup file to be external
        external: [/file-setup/]
      }
    }
  }
})
