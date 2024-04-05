import { createDefer } from '@vitest/utils'
import { afterAll, describe, test } from 'vitest'

describe('basic', () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  afterAll(async () => {
    await defers[3]
  })

  describe('1st suite', { concurrentSuite: true }, () => {
    test('0', async () => {
      defers[0].resolve()
    })

    test('1', async () => {
      await defers[2] // this would deadlock if sequential
      defers[1].resolve()
    })
  })

  describe('2nd suite', { concurrentSuite: true }, () => {
    test('2', async () => {
      await defers[0]
      defers[2].resolve()
    })
    test('3', async () => {
      await defers[1]
      defers[3].resolve()
    })
  })
})

describe('inherits option', { concurrentSuite: true }, () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  afterAll(async () => {
    await defers[3]
  })

  describe('1st suite', () => {
    test('0', async () => {
      defers[0].resolve()
    })

    test('1', async () => {
      await defers[2] // this would deadlock if sequential
      defers[1].resolve()
    })
  })

  describe('2nd suite', () => {
    test('2', async () => {
      await defers[0]
      defers[2].resolve()
    })
    test('3', async () => {
      await defers[1]
      defers[3].resolve()
    })
  })
})

describe('works with describe.each', () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  afterAll(async () => {
    await defers[3]
  })

  describe.each([0, 1])('%s', { concurrentSuite: true }, (i) => {
    if (i === 0) {
      test('0', async () => {
        defers[0].resolve()
      })

      test('1', async () => {
        await defers[2] // this would deadlock if sequential
        defers[1].resolve()
      })
    }

    if (i === 1) {
      test('2', async () => {
        await defers[0]
        defers[2].resolve()
      })
      test('3', async () => {
        await defers[1]
        defers[3].resolve()
      })
    }
  })
})
