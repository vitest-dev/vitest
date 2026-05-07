import { expect, test, vi } from 'vitest'

vi.mock('../../src/mocks/default', () => {
  throw new Error('some error')
})

test('when using top level variable, gives helpful message', async () => {
  await expect(() => import('../../src/mocks/default').then(m => m.default)).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: [vitest] There was an error when mocking a module. If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. Read more: https://vitest.dev/api/vi.html#vi-mock]`)
})
