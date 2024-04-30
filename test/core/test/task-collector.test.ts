import { expect, test, vi } from 'vitest'
import { createTaskCollector } from 'vitest/suite'

test('collector keeps the order of arguments', () => {
  const fn = vi.fn()
  const collector = createTaskCollector(fn)
  const cb = vi.fn()
  const options = {}

  collector('a', cb, options)

  expect(fn).toHaveBeenNthCalledWith(1, 'a', cb, options)

  collector('a', options, cb)

  expect(fn).toHaveBeenNthCalledWith(2, 'a', options, cb)

  collector.each([1])('a', cb, options)

  expect(fn).toHaveBeenNthCalledWith(3, 'a', expect.any(Function), options)

  collector.each([1])('a', options, cb)

  expect(fn).toHaveBeenNthCalledWith(4, 'a', options, expect.any(Function))
})
