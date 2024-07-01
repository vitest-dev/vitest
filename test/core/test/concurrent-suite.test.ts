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

  describe('1st suite', { concurrent: true }, () => {
    test('0', async () => {
      defers[0].resolve()
    })

    test('1', async () => {
      await defers[2] // this would deadlock if sequential
      defers[1].resolve()
    })
  })

  describe('2nd suite', { concurrent: true }, () => {
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

describe('inherits option', { concurrent: true }, () => {
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

  describe.each(['1st suite', '2nd suite'])('%s', { concurrent: true }, (s) => {
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

describe('override concurrent', { concurrent: true }, () => {
  checkParallelSuites()

  describe('s-x', { concurrent: false }, () => {
    checkSequentialTests()
  })

  describe.sequential('s-x-1', () => {
    checkSequentialTests()
  })

  describe('s-x-2', { sequential: true }, () => {
    checkSequentialTests()
  })

  describe('s-y', () => {
    checkParallelTests()
  })
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function checkSequentialTests() {
  let x = 0

  test('t1', async () => {
    await sleep(200)
    expect(x).toBe(0)
    x++
  })

  test('t2', async () => {
    expect(x).toBe(1)
  })
}

function checkParallelTests() {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
  ]

  test('t1', async () => {
    defers[0].resolve()
    await defers[1]
  })

  test('t2', async () => {
    await defers[0]
    defers[1].resolve()
  })
}

function checkParallelSuites() {
  const defers = [
    createDefer<void>(),
    createDefer<void>(),
  ]

  describe('s1', () => {
    test('t1', async () => {
      defers[0].resolve()
      await defers[1]
    })
  })

  describe('s2', () => {
    test('t1', async () => {
      await defers[0]
      defers[1].resolve()
    })
  })
}
