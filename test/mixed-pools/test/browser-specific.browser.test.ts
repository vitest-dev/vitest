import { expect, test } from 'vitest'

test('has access to browser API', () => {
  expect(window).toBeDefined()
})

test('doesn\'t have access to child_process API', () => {
  // we polyfill "process" in browser
  expect(process).toBeDefined()
  expect(process.send).toBeUndefined()
})

test('doesn\'t have access to threads API', async () => {
  const name = 'worker_threads'
  await expect(import(name)).rejects.toThrow()
})
