// @ts-expect-error virtual module
import { value } from 'virtual-module-importoriginal'
import { expect, test, vi } from 'vitest'

vi.mock('virtual-module-importoriginal', async (importOriginal) => {
  const original = await importOriginal<{ value: string }>()
  return {
    value: `${original.value}-modified`,
  }
})

test('importOriginal returns original virtual module exports', () => {
  expect(value).toBe('original-importoriginal-modified')
})
