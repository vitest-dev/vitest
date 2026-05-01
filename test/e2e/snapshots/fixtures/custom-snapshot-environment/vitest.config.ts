import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    snapshotEnvironment: './snapshot-environment.ts'
  }
})