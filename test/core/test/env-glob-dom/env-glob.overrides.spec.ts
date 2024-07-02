import { expect, test } from 'vitest'

/**
 * @vitest-environment edge-runtime
 */

test('glob on folder overrides', () => {
  expect(expect.getState().environment).toBe('edge-runtime')
})
