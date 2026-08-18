import { defineConfig } from 'vitest/config'
import { createSyncTransportPool } from './pool/sync-transport-pool'

export default defineConfig({
  test: {
    name: 'sync-transport-pool-test',
    pool: createSyncTransportPool(),
  },
})
