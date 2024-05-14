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
