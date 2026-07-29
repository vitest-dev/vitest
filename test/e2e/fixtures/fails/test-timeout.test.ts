import { beforeAll, beforeEach, expect, suite, test } from 'vitest'

test('hi', async () => {
  await new Promise(resolve => setTimeout(resolve, 1000))
}, 10)

test('timeout on long synchronous task', async () => {
  const start = Date.now();

  while (Date.now() < start + 20) {
  }
}, 15)

suite('timeout beforeAll', () => {
  beforeAll(() => {
    const start = Date.now();
    while (Date.now() < start + 20) {}
  }, 16)

  test("ok", () => {})
})

suite('timeout beforeEach', () => {
  beforeEach(() => {
    const start = Date.now();
    while (Date.now() < start + 20) {}
  }, 17)

  test("ok", () => {})
})

suite('suite timeout', {
  timeout: 100,
}, () => {
  test('hi', async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })
})

suite('suite timeout simple input', () => {
  test('hi', async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })
}, 200)

test('auto await async assertion', { timeout: 20 }, () => {
  expect(new Promise(() => {})).resolves.toBe(0)
})
