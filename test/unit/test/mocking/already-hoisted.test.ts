vi.mock('node:path', () => ({ mocked: true }))

import { expect, test, vi } from 'vitest'

import * as path from 'node:path'

test('already hoisted', () => {
  expect(path).toHaveProperty('mocked', true)
})
