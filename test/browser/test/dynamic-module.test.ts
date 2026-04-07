import { expect, test, vi } from 'vitest'

test('can await the end of the dynamic import', async () => {
  const _promise = import('../src/dynamic')
  const spy = vi.fn()
  window.addEventListener('module:loaded', spy)
  await vi.dynamicImportSettled()
  expect(spy).toHaveBeenCalled()
})
