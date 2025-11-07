import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('setting resetMocks works if restoreMocks is also set', async () => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': {
      test: {
        restoreMocks: true,
        mockReset: true,
      },
    },
    './mocked.js': `
export function spy() {}
    `,
    './basic.test.js': `
import { vi, test, expect } from 'vitest'
import { spy } from './mocked.js'

vi.mock('./mocked.js', { spy: true })

test('spy is called here', () => {
  spy()
  expect(spy).toHaveBeenCalled()
})

test('spy is not called here', () => {
  expect(spy).not.toHaveBeenCalled()
})
    `,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "spy is called here": "passed",
        "spy is not called here": "passed",
      },
    }
  `)
})
