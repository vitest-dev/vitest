// @ts-expect-error mocked module
import { mocked } from 'extension.js'
import { expect, test, vi } from 'vitest'

vi.mock('extension.js')

test('module with extension is mocked', () => {
  expect(mocked).toBe(true)
})
