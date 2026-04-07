import { expect, test } from 'vitest'
import { counter } from './counter'

test('make sure the counter is reset by the setup file beforeEach hook', () => {
  counter.increment()
  expect(counter.get()).toBe(1)
});
