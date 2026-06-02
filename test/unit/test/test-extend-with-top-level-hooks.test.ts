import { afterEach, beforeEach, expect, test } from 'vitest'

interface Fixture { foo: number }

const test1 = test.extend<Fixture>({
  foo: 1,
})

const test2 = test.extend<Fixture>({
  foo: 2,
})

test1('the foo should be 1', ({ foo }) => {
  expect(foo).toBe(1)
})

test2('the foo should be 2', ({ foo }) => {
  expect(foo).toBe(2)
})

let nextFoo = 1
beforeEach<Fixture>(({ foo }) => {
  expect(foo).toBe(nextFoo)
})

afterEach<Fixture>(({ foo }) => {
  expect(foo).toBe(nextFoo)
  nextFoo++
})
