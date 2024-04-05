import { createDefer } from '@vitest/utils'
import { afterAll, describe, expect, test } from 'vitest'

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

  describe.each(['1st suite', '2nd suite'])('%s', { concurrentSuite: true }, (s) => {
    if (s === '1st suite') {
      test('0', async () => {
        defers[0].resolve()
      })

      test('1', async () => {
        await defers[2] // this would deadlock if sequential
        defers[1].resolve()
      })
    }

    if (s === '2nd suite') {
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('tests are sequential', () => {
  describe('1st suite', { concurrentSuite: true }, () => {
    let done = false

    test('0', async () => {
      await sleep(200)
      expect(done).toBe(false)
    })

    test('1', async () => {
      await sleep(100)
      done = true
    })

    test('2', () => {
      expect(done).toBe(true)
    })
  })
})

// TODO
describe('maxConcurrency', { concurrent: true, concurrentSuite: true }, () => {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
    createDefer<void>(),
  ]

  describe('1st suite', () => {
    test('0', async () => {
      defers[0].resolve()
      await defers[3]
    })

    test('1', async () => {
      await defers[0]
      defers[1].resolve()
    })
  })

  describe('2nd suite', () => {
    test('2', async () => {
      await defers[1]
      defers[2].resolve()
    })

    test('3', async () => {
      await defers[2]
      defers[3].resolve()
    })
  })
})
