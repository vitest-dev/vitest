import { afterEach, beforeEach, expect, test } from 'vitest'

beforeEach(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 300)
  })
})

afterEach(async () => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, 300)
  })
})

test('server running', async () => {
  const res = await (await fetch('http://0.0.0.0:9876')).text()
  expect(res).toBe('Hello Vitest\n')
})

test('vite instance running', async () => {
  const res = await (await fetch('http://localhost:9988')).text()
  expect(res).toContain('<script type="module" src="/@vite/client">')
  expect(res).toContain('Hello Vitest\n')
})
