import { expect, test, vi } from 'vitest'

vi.mock('../src/unloaded', () => ({ unloaded: () => 'mocked' }))

test('the mocked module is never imported in this file', () => {
  expect(document.body).toBeDefined()
})
