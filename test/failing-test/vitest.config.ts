/// <reference types="vitest" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    plugin: [react()],
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
