/// <reference types="vitest" />

import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    esbuild: {
      jsxInject: `import React from 'react'`,
    },
    test: {
      deps: {
        inline: [],
      },
      environment: 'jsdom',
      global: true,
    },
  };
});
