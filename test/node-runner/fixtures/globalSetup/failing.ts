import assert from 'node:assert'
// node can import from vitest at any point
import { beforeAll } from 'vitest'

assert.throws(() => {
  // some vitest API cannot be used outside of a test context
  beforeAll(() => {})
}, /Vitest failed to find the runner. One of the following is possible/)

export default () => {}
