import type { Pool } from 'vitest/node'
import { defineWorkspace } from 'vitest/config'

function project(pool: Pool) {
  return {
    extends: './vite.config.ts',
    test: {
      name: pool,
      pool,
    },
  }
}

export default defineWorkspace([
  project('threads'),
  project('forks'),
  project('vmThreads'),
  project('vmForks'),
])
