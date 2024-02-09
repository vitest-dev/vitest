import { expect, test, vi } from 'vitest'

test('supports wasm/js cyclic import (old wasm-bindgen output)', async () => {
  globalThis.alert = vi.fn()

  // @ts-expect-error not typed
  const { greet } = await import('../src/wasm-bindgen/index.js')
  greet('World')

  expect(globalThis.alert).toHaveBeenCalledWith('Hello, World!')
})

test('supports wasm-bindgen', async () => {
  globalThis.alert = vi.fn()

  const { greet } = await import('../src/wasm-bindgen-no-cyclic/index.js')
  greet('No Cyclic')

  expect(globalThis.alert).toHaveBeenCalledWith('Hello, No Cyclic!')
})
