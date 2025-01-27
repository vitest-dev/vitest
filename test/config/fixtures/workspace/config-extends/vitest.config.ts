import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'virtual',
      resolveId(source) {
        if (source === 'virtual:repro') {
          return '\0virtual:repro';
        }
      },
      load(id) {
        if (id === '\0virtual:repro') {
          return `export default "Hello, world!"`;
        }
      },
    },
  ],
  test: {
    workspace: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
        },
      },
    ],
  },
});
