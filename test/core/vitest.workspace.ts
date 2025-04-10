import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: { label: 'threads', color: 'red' },
      pool: 'threads',
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: { label: 'forks', color: 'green' },
      pool: 'forks',
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: { label: 'vmThreads', color: 'blue' },
      pool: 'vmThreads',
    },
  },
])
