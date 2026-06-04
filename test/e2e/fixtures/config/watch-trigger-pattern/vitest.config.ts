import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watchTriggerPatterns: [
      {
        pattern: /folder\/(\w+)\/.*\.txt$/,
        testsToRun: (id, match) => {
          return `./folder/${match[1]}/basic.test.ts`;
        },
      }
    ]
  }
})