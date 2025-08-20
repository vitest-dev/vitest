import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest'

// Import the resolveConfig function to test the actual configuration resolution
import { resolveConfig } from '../../../packages/vitest/src/node/config/resolveConfig'
import { Vitest } from '../../../packages/vitest/src/node/core'

// Set the global that's needed for resolveConfig
globalThis.__VITEST_GENERATE_UI_TOKEN__ = true

describe('VITEST_WATCH Environment Variable', () => {
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    // Store original TTY state
    originalIsTTY = process.stdin.isTTY
    // Clean up any previous environment stubs
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    // Restore TTY state
    if (originalIsTTY !== undefined) {
      process.stdin.isTTY = originalIsTTY
    }
    // Clean up environment stubs
    vi.unstubAllEnvs()
  })

  describe('Environment Variable Parsing', () => {
    test.each([
      { value: 'true', expected: true, description: 'VITEST_WATCH=true' },
      { value: 'false', expected: false, description: 'VITEST_WATCH=false' },
      { value: '1', expected: true, description: 'VITEST_WATCH=1' },
      { value: '0', expected: false, description: 'VITEST_WATCH=0' },
      { value: 'yes', expected: true, description: 'VITEST_WATCH=yes' },
      { value: 'no', expected: false, description: 'VITEST_WATCH=no' },
      { value: 'TRUE', expected: true, description: 'VITEST_WATCH=TRUE (uppercase)' },
      { value: 'FALSE', expected: false, description: 'VITEST_WATCH=FALSE (uppercase)' },
      { value: 'invalid', expected: false, description: 'VITEST_WATCH=invalid' },
      { value: '', expected: false, description: 'VITEST_WATCH= (empty)' },
    ])('$description should resolve to $expected', async ({ value, expected }) => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', undefined)
      vi.stubEnv('VITEST_WATCH', value)

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      const config = resolveConfig(vitest, {}, viteConfig)
      expect(config.watch).toBe(expected)

      await vitest.close()
    })
  })

  describe('Default Behavior & Backward Compatibility', () => {
    test('should use default detection when VITEST_WATCH is not set', async () => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', undefined)
      vi.stubEnv('VITEST_WATCH', undefined)

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      const config = resolveConfig(vitest, {}, viteConfig)
      // Should be true because !isCI && isTTY = !false && true = true
      expect(config.watch).toBe(true)

      await vitest.close()
    })

    test('should respect CI environment when VITEST_WATCH is not set', async () => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', '1')
      vi.stubEnv('VITEST_WATCH', undefined)

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      const config = resolveConfig(vitest, {}, viteConfig)
      // Should be false because CI is true
      expect(config.watch).toBe(false)

      await vitest.close()
    })

    test('should respect TTY when VITEST_WATCH is not set', async () => {
      // Set up test environment
      process.stdin.isTTY = false
      vi.stubEnv('CI', undefined)
      vi.stubEnv('VITEST_WATCH', undefined)

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      const config = resolveConfig(vitest, {}, viteConfig)
      // Should be false because !isCI && isTTY = !false && false = false
      expect(config.watch).toBe(false)

      await vitest.close()
    })
  })

  describe('Precedence & Configuration Priority', () => {
    test('VITEST_WATCH should override CI environment', async () => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', '1')
      vi.stubEnv('VITEST_WATCH', 'true')

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      const config = resolveConfig(vitest, {}, viteConfig)
      // Should be true because VITEST_WATCH takes precedence over CI
      expect(config.watch).toBe(true)

      await vitest.close()
    })

    test('VITEST_WATCH should override default detection', async () => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', undefined)
      vi.stubEnv('VITEST_WATCH', 'false')

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      const config = resolveConfig(vitest, {}, viteConfig)
      // Should be false because VITEST_WATCH takes precedence over default detection
      expect(config.watch).toBe(false)

      await vitest.close()
    })

    test('user config should take precedence over environment variable', async () => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', undefined)
      vi.stubEnv('VITEST_WATCH', 'false')

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      // User config sets watch: true, environment variable should not override
      const config = resolveConfig(vitest, { watch: true }, viteConfig)
      expect(config.watch).toBe(true) // User config takes precedence over env var

      await vitest.close()
    })

    test('CLI flags should still take precedence over environment variable', async () => {
      // Set up test environment
      process.stdin.isTTY = true
      vi.stubEnv('CI', undefined)
      vi.stubEnv('VITEST_WATCH', 'true')

      const vitest = new Vitest('test', {})
      const viteConfig = { root: process.cwd() } as any

      // Explicit CLI/user config should override environment variable
      const config = resolveConfig(vitest, { watch: false }, viteConfig)

      expect(config.watch).toBe(false)

      await vitest.close()
    })
  })
})
