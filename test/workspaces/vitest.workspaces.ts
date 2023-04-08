import { defineWorkspaces } from 'vitest/config'

export default defineWorkspaces([
  './space_2/*',
  './space_*/*.config.ts',
  {
    test: {
      name: 'jsdom',
      root: './space_shared',
      environment: 'jsdom',
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
