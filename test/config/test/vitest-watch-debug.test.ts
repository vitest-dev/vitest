import { expect, test, describe } from 'vitest'
import { withEnv, mockTTY, mockCI } from '../../test-utils/vitest-watch-helpers'
import { configDefaults } from '../../../packages/vitest/src/defaults'

describe('VITEST_WATCH Debug Test', () => {
  test('debug current environment values', async () => {
    console.log('Current environment:')
    console.log('process.env.CI:', process.env.CI)
    console.log('process.env.VITEST_WATCH:', process.env.VITEST_WATCH)
    console.log('process.stdin.isTTY:', process.stdin.isTTY)

    // Check what our getWatchMode function returns
    const watchValue = configDefaults.watch
    console.log('configDefaults.watch:', watchValue)

    // This test is just for debugging, so we'll always pass
    expect(true).toBe(true)
  })

  test('debug with mocked values', async () => {
    const restoreTTY = mockTTY(true)
    const restoreCI = mockCI(false)

    try {
      await withEnv({ VITEST_WATCH: undefined }, async () => {
        console.log('Mocked environment:')
        console.log('process.env.CI:', process.env.CI)
        console.log('process.env.VITEST_WATCH:', process.env.VITEST_WATCH)
        console.log('process.stdin.isTTY:', process.stdin.isTTY)

        const watchValue = configDefaults.watch
        console.log('configDefaults.watch:', watchValue)

        // This test is just for debugging, so we'll always pass
        expect(true).toBe(true)
      })
    } finally {
      restoreTTY()
      restoreCI()
    }
  })
})
