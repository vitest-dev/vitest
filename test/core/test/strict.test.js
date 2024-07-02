import { describe, expect, test } from 'vitest'

describe('vitest runs code in strict mode', () => {
  test('throws as defined in spec', () => {
    const o = { id: 1 }
    Object.defineProperty(o, 'id', { writable: false, configurable: false })

    expect(() => o.id = 42).toThrowError(TypeError)
  })

  test('cannot defined non existing variable', () => {
    expect(() => {
      someGlobalVariableICameUpWith = 22
    }).toThrowError()
  })

  test('cannot redefine getter', () => {
    const obj2 = {
      get x() {
        return 17
      },
    }
    expect(() => {
      obj2.x = 5
    }).toThrowError(TypeError)
  })

  test('cannot declare properties on primitives', () => {
    expect(() => false.true = '').toThrowError(TypeError)
    expect(() => (14).sailing = 'home').toThrowError(TypeError)
    expect(() => 'with'.you = 'far away').toThrowError(TypeError)
  })
})
