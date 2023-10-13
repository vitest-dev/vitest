// this test checks only vi.hoisted because vi.mock affects the regexp to find this

import { afterAll, expect, it, vi } from 'vitest'
import { value } from '../src/rely-on-hoisted'

const globalValue = await vi.hoisted(async () => {
  // @ts-expect-error not typed global
  globalThis.someGlobalValue = 'globalValue'
  return 'globalValue'
})

afterAll(() => {
  // @ts-expect-error not typed global
  delete globalThis.someGlobalValue
})

it('imported value is equal to returned from hoisted', () => {
  expect(value).toBe(globalValue)
})
