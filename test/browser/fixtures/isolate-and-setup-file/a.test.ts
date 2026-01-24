import { expect, test } from 'vitest'
import { counter } from './counter'

test('increment counter', () => {
  counter.increment()
  expect(counter.get()).toBe(1)
});
