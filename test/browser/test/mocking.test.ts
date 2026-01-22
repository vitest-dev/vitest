import { expect, test, vi } from 'vitest'
import * as module from '../src/calculator'

const browserRunner = (globalThis as any).__vitest_browser_runner__
const isBrowserMode = browserRunner !== null && typeof browserRunner === 'object'

test.runIf(isBrowserMode)('spying on an esm module prints an error', () => {
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
  expect(error.message).toMatchInlineSnapshot(`"Cannot spy on export "calculator". Module namespace is not configurable in ESM. See: https://vitest.dev/guide/browser/#spying-on-module-exports"`)

  expect(error.cause).toBeInstanceOf(TypeError)
})
