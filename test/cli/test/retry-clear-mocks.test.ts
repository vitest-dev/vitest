import type { TestCase } from 'vitest/node'
import { expect, it } from 'vitest'
import { runInlineTests } from '../../test-utils'

it('vitest correctly resets mocks between tests', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.js': /* js */`
      import { it, vi, expect } from 'vitest'
      let i = 0
      const mock = vi.fn(() => true)
      it('mock resets', { retry: 3 }, () => {
        i++
        expect(mock()).toBe(true)
        mock.mockImplementation(() => false)
        if (i !== 4) {
          throw new Error('retry')
        }
        expect(mock).toHaveBeenCalledOnce()
      })
    `,
    'vitest.config.js': {
      test: {
        mockReset: true,
      },
    },
  })
  expect(stderr).toBe('')
  const testCase = results[0].children.at(0) as TestCase
  expect(testCase.diagnostic()?.retryCount).toBe(3)
})

it('vitest correctly clears mocks between tests', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.js': /* js */`
      import { it, vi, expect } from 'vitest'
      let i = 0
      const mock = vi.fn()
      it('mock resets', { retry: 3 }, () => {
        i++
        mock()
        if (i !== 4) {
          throw new Error('retry')
        }
        expect(mock).toHaveBeenCalledOnce()
      })
    `,
    'vitest.config.js': {
      test: {
        clearMocks: true,
      },
    },
  })
  expect(stderr).toBe('')
  const testCase = results[0].children.at(0) as TestCase
  expect(testCase.diagnostic()?.retryCount).toBe(3)
})

it('vitest correctly restores mocks between tests', async () => {
  const { stderr, results } = await runInlineTests({
    'basic.test.js': /* js */`
      import { it, vi, expect } from 'vitest'
      let i = 0
      const obj = {
        mock: () => true
      }
      const mock = vi.spyOn(obj, 'mock')
      it('mock resets', { retry: 3 }, () => {
        i++
        expect(obj.mock()).toBe(true)
        expect(vi.isMockFunction(obj.mock)).toBe(false)
        mock.mockImplementation(() => false)
        if (i !== 4) {
          throw new Error('retry')
        }
      })
    `,
    'vitest.config.js': {
      test: {
        restoreMocks: true,
      },
    },
  })
  expect(stderr).toBe('')
  const testCase = results[0].children.at(0) as TestCase
  expect(testCase.diagnostic()?.retryCount).toBe(3)
})
