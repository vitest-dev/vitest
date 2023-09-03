import { afterEach, beforeEach, expect, test as originalTest } from 'vitest'

interface Fixture { foo: number }

const test = originalTest.extend<Fixture>({
  // eslint-disable-next-line no-empty-pattern
  foo: async ({}, use) => {
    await use(1)
  },
})

beforeEach<Fixture>(({ foo }) => {
  expect(foo).toBe(1)
})

afterEach<Fixture>(({ foo }) => {
  expect(foo).toBe(1)
})

test('placeholder', ({ foo }) => {
  expect(foo).toBe(1)
})
