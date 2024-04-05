import { describe, test } from 'vitest'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// finishes in 3 sec
// (1st and 2nd suites in parallel)
describe('example-1', () => {
  // finishes in 3 sec
  // (1st and 2nd cases in serial)
  describe('1st suite', { concurrentSuite: true }, () => {
    test('1st case', async () => {
      await sleep(1000)
    })
    test('2nd case', async () => {
      await sleep(2000)
    })
  })

  describe('2nd suite', { concurrentSuite: true }, () => {
    test('1st case', async () => {
      await sleep(1000)
    })
    test('2nd case', async () => {
      await sleep(2000)
    })
  })
})

// finishes in 3 sec
// (same as example-1 but implemented as describe.each)
describe('example-2', () => {
  describe.each(['1st suite', '2nd suite'])('%s', { concurrentSuite: true }, () => {
    test('1st case', async () => {
      await sleep(1000)
    })
    test('2nd case', async () => {
      await sleep(2000)
    })
  })
})

describe.only('example-3', () => {
  describe('nested', { concurrentSuite: true }, () => {
    // finishes in 3 sec
    // (1st and 2nd cases in serial)
    describe('1st suite', () => {
      test('1st case', async () => {
        await sleep(1000)
      })
      test('2nd case', async () => {
        await sleep(2000)
      })
    })

    describe('2nd suite', () => {
      test('1st case', async () => {
        await sleep(1000)
      })
      test('2nd case', async () => {
        await sleep(2000)
      })
    })
  })
})
