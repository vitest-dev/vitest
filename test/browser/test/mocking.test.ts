import { expect, it, vi } from 'vitest'
import * as module from '../src/calculator'

it('spying on an esm module prints an error', () => {
  const error: Error = (() => {
    try {
      vi.spyOn(module, 'calculator')
      expect.unreachable()
    }
    catch (err) {
      return err
    }
  })()
  expect(error.name).toBe('TypeError')
  expect(error.message).toMatchInlineSnapshot(`"Cannot spy on export "calculator". Module namespace is not configurable in ESM. See: https://vitest.dev/guide/browser/#limitations"`)

  expect(error.cause).toBeInstanceOf(TypeError)
})
