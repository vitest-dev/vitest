import { WorkerGlobalState, expect, test, vi } from 'vitest'
import { foo } from '../src'

vi.mock('../src', () => ({
  foo: 'baz',
}))

// @ts-expect-error untyped global
const state = globalThis.__vitest_worker__ as WorkerGlobalState

test('module is mocked', () => {
  expect(foo).toBe('baz')
  expect(state.config.base).toBe('/some/base/url/')
})
