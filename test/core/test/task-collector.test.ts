import type { RunnerTestCase, RunnerTestSuite } from 'vitest'
import { assert, describe, expect, test, vi } from 'vitest'
import { createTaskCollector, getCurrentSuite } from 'vitest/suite'

test('collector keeps the order of arguments', () => {
  const fn = vi.fn()
  const collector = createTaskCollector(fn)
  const cb = vi.fn()
  const options = { timeout: 100 }

  collector('a', cb, options.timeout)

  expect(fn).toHaveBeenNthCalledWith(1, 'a', cb, options)

  collector('a', options, cb)

  expect(fn).toHaveBeenNthCalledWith(2, 'a', options, cb)

  collector.each([1])('a', cb, options.timeout)

  expect(fn).toHaveBeenNthCalledWith(3, 'a', expect.any(Function), options)

  collector.each([1])('a', options, cb)

  expect(fn).toHaveBeenNthCalledWith(4, 'a', options, expect.any(Function))
})

describe('collector.extend should preserve handler wrapping', () => {
  let flag = false

  const flagTest = createTaskCollector(function (
    this: object,
    name: string,
    fn: () => void,
  ) {
    const handler = async () => {
      flag = false
      await fn()
      assert(flag)
    }
    getCurrentSuite().task(name, { ...this, handler })
  })

  const extendedTest = flagTest.extend({})

  extendedTest.fails('should fail when flag is never set', {}, () => {})

  flagTest('should pass when flag is set', () => {
    flag = true
    expect(flag).toBe(true)
  })
})

describe('empty tests and suites are todos', () => {
  describe('suite should be todo')
  test('test should be todo')

  test('this suite has correct modes', ({ task }) => {
    const todoSuite = task.suite!.tasks[0] as RunnerTestSuite
    const todoTest = task.suite!.tasks[0] as RunnerTestCase

    expect(todoSuite.name).toBe('suite should be todo')
    expect(todoSuite.mode).toBe('todo')

    expect(todoTest.name).toBe('suite should be todo')
    expect(todoTest.mode).toBe('todo')
  })
})
