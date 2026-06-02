import { afterAll, beforeAll, describe, expect, test } from 'vitest'

beforeAll(() => {
  console.log('global stdin beforeAll')
  console.error('global stderr beforeAll')
})

afterAll(() => {
  console.log('global stdin afterAll')
  console.error('global stderr afterAll')
})

describe('suite', () => {
  beforeAll(() => {
    console.log('suite stdin beforeAll')
    console.error('suite stderr beforeAll')
  })

  afterAll(() => {
    console.log('suite stdin afterAll')
    console.error('suite stderr afterAll')
  })

  describe('nested suite', () => {
    beforeAll(() => {
      console.log('nested suite stdin beforeAll')
      console.error('nested suite stderr beforeAll')
    })

    afterAll(() => {
      console.log('nested suite stdin afterAll')
      console.error('nested suite stderr afterAll')
    })

    test('test', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(true).toBe(true)
    })
  })
})
