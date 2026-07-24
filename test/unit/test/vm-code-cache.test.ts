import { expect, test, vi } from 'vitest'
import { CodeCache } from 'vitest/src/runtime/vm/code-cache.js'

test('returns the stored data only for the exact same source', () => {
  const cache = new CodeCache()
  const data = Buffer.from('cached')

  expect(cache.get('/mod.js', 'source')).toBeUndefined()

  cache.store('/mod.js', 'source', () => data)

  expect(cache.get('/mod.js', 'source')).toBe(data)
  expect(cache.get('/mod.js', 'changed source')).toBeUndefined()
  expect(cache.get('/other.js', 'source')).toBeUndefined()
})

test('does not produce again for the same source', () => {
  const cache = new CodeCache()
  const produce = vi.fn(() => Buffer.from('cached'))

  cache.store('/mod.js', 'source', produce)
  cache.store('/mod.js', 'source', produce)

  expect(produce).toHaveBeenCalledTimes(1)
})

test('replaces the entry when the source changes', () => {
  const cache = new CodeCache()
  const first = Buffer.from('first')
  const second = Buffer.from('second')

  cache.store('/mod.js', 'source', () => first)
  cache.store('/mod.js', 'changed source', () => second)

  expect(cache.get('/mod.js', 'source')).toBeUndefined()
  expect(cache.get('/mod.js', 'changed source')).toBe(second)
})

test('records a failed produce and does not retry it', () => {
  const cache = new CodeCache()
  const produce = vi.fn<() => Buffer>(() => {
    throw new Error('cannot create cached data')
  })

  cache.store('/mod.js', 'source', produce)
  cache.store('/mod.js', 'source', produce)

  expect(produce).toHaveBeenCalledTimes(1)
  expect(cache.get('/mod.js', 'source')).toBeUndefined()
})

test('delete removes the entry', () => {
  const cache = new CodeCache()
  const produce = vi.fn(() => Buffer.from('cached'))

  cache.store('/mod.js', 'source', produce)
  cache.delete('/mod.js')

  expect(cache.get('/mod.js', 'source')).toBeUndefined()

  cache.store('/mod.js', 'source', produce)
  expect(produce).toHaveBeenCalledTimes(2)
})
