import { describe, expect, test } from 'vitest'

describe('vitest runs code in strict mode', () => {
  test('throws as defined in spec', () => {
    const o = { id: 1 }
    Object.defineProperty(o, 'id', { writable: false, configurable: false })

    expect(() => o.id = 42).toThrow(TypeError)
  })

  test('cannot defined non existing variable', () => {
    expect(() => {
      someGlobalVariableICameUpWith = 22
    }).toThrow()
  })

  test('cannot redefine getter', () => {
    const obj2 = {
      get x() {
        return 17
      },
    }
    expect(() => {
      obj2.x = 5
    }).toThrow(TypeError)
  })

  test('cannot declare properties on primitives', () => {
    expect(() => false.true = '').toThrow(TypeError)
    expect(() => (14).sailing = 'home').toThrow(TypeError)
    expect(() => 'with'.you = 'far away').toThrow(TypeError)
  })
})
