import { defineConfig } from 'vitest/config'
import { setup } from './setup-attest-analyze';

export default defineConfig({
  test: {
    setupFiles: ['./setup-attest-snapshot.ts'],
    // use reporter's onWatcherRerun until we have https://github.com/vitest-dev/vitest/pull/6803
    // globalSetup: ['./setup-attest-analyze.ts'],
    reporters: [
      "default",
      {
        onInit: () => setup(),
        onWatcherRerun: () => setup(),
      }
    ]
  },
})
