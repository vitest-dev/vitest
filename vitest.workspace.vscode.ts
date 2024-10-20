import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  './test/core',
  './test/cli',
  './test/config',
])
