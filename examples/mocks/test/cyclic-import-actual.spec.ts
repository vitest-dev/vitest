import { expect, test, vi } from 'vitest'

import '../src/cyclic-deps/module-1'

vi.mock('../src/cyclic-deps/module-2', async () => {
  await vi.importActual('../src/cyclic-deps/module-2')

  return { default: () => {} }
})

test('some test', () => {
  expect(1 + 1).toBe(2)
})
