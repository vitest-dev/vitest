import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: [
      {
        test: {
          name: 'unit',
        },
      },
    ],
  },
})