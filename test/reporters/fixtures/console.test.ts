import { afterAll, beforeAll, describe, expect, test } from 'vitest'

beforeAll(() => {
  console.log('beforeAll')
  console.error('beforeAll')
})

afterAll(() => {
  console.log('afterAll')
  console.error('afterAll')
})

describe('suite', () => {
  beforeAll(() => {
    console.log('beforeAll')
    console.error('beforeAll')
  })

  afterAll(() => {
    console.log('afterAll')
    console.error('afterAll')
  })

  describe('nested suite', () => {
    beforeAll(() => {
      console.log('beforeAll')
      console.error('beforeAll')
    })

    afterAll(() => {
      console.log('afterAll')
      console.error('afterAll')
    })

    test('test', () => {
      expect(true).toBe(true)
    })
  })
})
