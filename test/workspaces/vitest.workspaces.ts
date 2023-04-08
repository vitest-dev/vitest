import { defineWorkspaces } from 'vitest/config'

export default defineWorkspaces([
  './space_2/*',
  './space_*/*.config.ts',
  {
    test: {
      name: 'happy-dom',
      root: './space_shared',
      environment: 'happy-dom',
      setupFiles: ['./setup.jsdom.ts'],
    },
  },
  {
    test: {
      name: 'node',
      root: './space_shared',
      environment: 'node',
      setupFiles: ['./setup.node.ts'],
    },
  },
])
