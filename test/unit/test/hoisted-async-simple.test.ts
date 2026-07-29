// this test checks only vi.hoisted because vi.mock affects the regexp to find this

import { afterAll, expect, it, vi } from 'vitest'
import { value } from '../src/rely-on-hoisted'

const globalValue = await vi.hoisted(async () => {
  // @ts-expect-error not typed global
  globalThis.someGlobalValue = 'globalValue'
  // @ts-expect-error not typed global
  ;(globalThis._order ??= []).push(1)
  return 'globalValue'
})

afterAll(() => {
  // @ts-expect-error not typed global
  delete globalThis.someGlobalValue
})

// _order is set in the hoisted function before tests are collected
// @ts-expect-error not typed global
expect(globalThis._order).toEqual([1, 2])

it('imported value is equal to returned from hoisted', () => {
  expect(value).toBe(globalValue)
})

await vi.hoisted(async () => {
  // @ts-expect-error not typed global
  ;(globalThis._order ??= []).push(2)
})
