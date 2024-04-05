import { createDefer } from '@vitest/utils'
import { describe, test, vi } from 'vitest'

vi.setConfig({ maxConcurrency: 2 })

describe('limit for each suite', () => {
  // this test requires running 3 tests in parallel.
  // but, currently p-limit is applied for each suite layer,
  // so tests succeed.
  //
  //  [0]  [1]  [2]
  //   * ->
  //        * ->
  //          <- *
  //     <------

  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  describe('1st suite', { concurrent: true, concurrentSuite: true }, () => {
    test('a', async () => {
      defers[0].resolve()
      await defers[2]
    })

    test('b', async () => {
      await defers[0]
      defers[1].resolve()
      await defers[2]
    })
  })

  describe('2nd suite', { concurrent: true, concurrentSuite: true }, () => {
    test('c', async () => {
      await defers[1]
      defers[2].resolve()
    })
  })
})
