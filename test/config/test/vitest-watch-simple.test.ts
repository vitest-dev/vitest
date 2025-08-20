import { expect, test, describe } from 'vitest'
import { withEnv, mockTTY, mockCI } from '../../test-utils/vitest-watch-helpers'

// Import the resolveConfig function to test the actual configuration resolution
import { resolveConfig } from '../../../packages/vitest/src/node/config/resolveConfig'
import { Vitest } from '../../../packages/vitest/src/node/core'

// Set the global that's needed for resolveConfig
globalThis.__VITEST_GENERATE_UI_TOKEN__ = true

describe('VITEST_WATCH Simple Test', () => {
  test('VITEST_WATCH=true should work', async () => {
    const restoreTTY = mockTTY(true)
    const restoreCI = mockCI(false)

    try {
      await withEnv({ VITEST_WATCH: 'true' }, async () => {
        // Create a minimal vitest instance and vite config for testing
        const vitest = new Vitest('test', {})
        const viteConfig = { root: process.cwd() } as any

        const config = resolveConfig(vitest, {}, viteConfig)

        expect(config.watch).toBe(true)

        await vitest.close()
      })
    } finally {
      restoreTTY()
      restoreCI()
    }
  })

  test('VITEST_WATCH=false should work', async () => {
    const restoreTTY = mockTTY(true)
    const restoreCI = mockCI(false)

    try {
      await withEnv({ VITEST_WATCH: 'false' }, async () => {
        const vitest = new Vitest('test', {})
        const viteConfig = { root: process.cwd() } as any

        const config = resolveConfig(vitest, {}, viteConfig)
        expect(config.watch).toBe(false)

        await vitest.close()
      })
    } finally {
      restoreTTY()
      restoreCI()
    }
  })

  test('default behavior should work', async () => {
    const restoreTTY = mockTTY(true)
    const restoreCI = mockCI(false)

    try {
      await withEnv({ VITEST_WATCH: undefined }, async () => {
        const vitest = new Vitest('test', {})
        const viteConfig = { root: process.cwd() } as any

        const config = resolveConfig(vitest, {}, viteConfig)

        // Should be true because !isCI && isTTY = !false && true = true
        expect(config.watch).toBe(true)

        await vitest.close()
      })
    } finally {
      restoreTTY()
      restoreCI()
    }
  })

  test('user config takes precedence over environment variable', async () => {
    const restoreTTY = mockTTY(true)
    const restoreCI = mockCI(false)

    try {
      await withEnv({ VITEST_WATCH: 'false' }, async () => {
        const vitest = new Vitest('test', {})
        const viteConfig = { root: process.cwd() } as any

        // User config sets watch: true, environment variable should not override
        const config = resolveConfig(vitest, { watch: true }, viteConfig)
        expect(config.watch).toBe(true) // User config takes precedence over env var

        await vitest.close()
      })
    } finally {
      restoreTTY()
      restoreCI()
    }
  })
})
