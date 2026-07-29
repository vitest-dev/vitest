import { expect, test } from 'vitest'

test('run initial', async () => {
  const initial = await import('../src/query-param-transformed')

  // Check that custom plugin works
  expect(initial.initial()).toBe("Always present")
  expect(initial.first).toBeUndefined()
  expect(initial.second).toBeUndefined()
})

test('run first', async () => {
  const initial = await import('../src/query-param-transformed?query=first' as '../src/query-param-transformed')

  // Check that custom plugin works
  expect(initial.initial()).toBe("Always present")
  expect(initial.first).toBeUndefined()
  expect(initial.second()).toBe("Removed when ?query=second")
})

test('run second', async () => {
  const initial = await import('../src/query-param-transformed?query=second' as '../src/query-param-transformed')

  // Check that custom plugin works
  expect(initial.initial()).toBe("Always present")
  expect(initial.first()).toBe("Removed when ?query=first")
  expect(initial.second).toBeUndefined()
})
