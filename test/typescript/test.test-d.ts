import { describe, expectTypeOf, test } from 'vitest'

describe('test', () => {
  test('some-test', () => {
    expectTypeOf(45).toBe(45)
    // expectTypeOf(45).toBe<Thor['name.first']>(80)
    // expectTypeOf(45).toBe<Thor['name.first.second.third']>(80)
    // expectTypeOf(45).toBe('22')
  })

  describe('test2', () => {
    test('some-test 2', () => {
      expectTypeOf(45).toBe(45)
    })
  })
})

expectTypeOf({ wolk: 'true' }).toHaveProperty('wolk')
