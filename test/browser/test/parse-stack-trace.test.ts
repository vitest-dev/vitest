import { test } from 'vitest'

class PrettyError extends globalThis.Error {
  constructor(e: unknown) {
    Error.stackTraceLimit = 0
    super(JSON.stringify(e))
  }
}

test('should not take ages...', async () => {
  const x = [...Array(100).keys()]
  const obj = Object.fromEntries(x.map(i => [`prop${i}`, i]))
  throw new PrettyError(obj)
})
