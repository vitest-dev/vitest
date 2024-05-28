import { expect, test, vi } from 'vitest'
import { parent } from './src/nested_parent'

const child = vi.hoisted(() => vi.fn())

vi.mock(import('./src/nested_child'), () => {
  return {
    child,
  }
})

test('adds', () => {
  child.mockReturnValue(42)
  expect(parent()).toBe(42)
})

test('actual', async () => {
  const { child } = await vi.importActual<
    typeof import('./src/nested_child')
  >('./src/nested_child')

  expect(child()).toBe(true)
})
