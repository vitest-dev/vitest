import { afterEach, test } from 'vitest'

class PrettyError extends globalThis.Error {
  constructor(e: unknown) {
    Error.stackTraceLimit = 0
    super(JSON.stringify(e))
  }
}

afterEach(() => {
  delete Error.stackTraceLimit
})

test('should not take ages...', async () => {
  const x = Array.from({ length: 100 }, (_, i) => i)
  const obj = Object.fromEntries(x.map(i => [`prop${i}`, i]))
  throw new PrettyError(obj)
})
