/**
 * @vitest-environment jsdom
 */

import { expect, test } from 'vitest'

test('Leaking globals not found', async () => {
  (globalThis as any).__leaking_from_jsdom = 'leaking'
  expect((globalThis as any).__leaking_from_node).toBe(undefined)
  expect((globalThis as any).__leaking_from_happy_dom).toBe(undefined)
})
