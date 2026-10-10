import { expect, test, vi } from 'vitest'

vi.mock('./src/unloaded', () => ({ source: () => 'mocked' }))

test('the mocked module is never loaded in this file', () => {
  expect(document.body).toBeDefined()
})
