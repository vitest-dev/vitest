// bar.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { Bar } from '../../src/class-inheritence/bar'

vi.mock(import('./../../src/class-inheritence/foo'))

describe('not mocking class when parent is mocked', () => {
  describe('doSomething', () => {
    it('returns true', () => {
      const bar = new Bar()
      expect(bar.doSomething()).toBe(true)
    })

    it('should match the prototype', () => {
      const bar = new Bar()
      expect(bar.doSomething).toBe(Bar.prototype.doSomething)
    })

    it('should not be mocked', () => {
      const bar = new Bar()
      expect(bar.doSomething).not.toHaveProperty('mock')
    })
  })

  describe('doSomethingElse', () => {
    it('returns true', () => {
      const bar = new Bar()
      expect(bar.doSomethingElse()).toBe(true)
    })

    it('should match the prototype', () => {
      const bar = new Bar()
      expect(bar.doSomethingElse).toBe(Bar.prototype.doSomethingElse)
    })

    it('should not be mocked', () => {
      const bar = new Bar()
      expect(bar.doSomethingElse).not.toHaveProperty('mock')
    })
  })
})

describe('mocking class when parent is not mocked', () => {
  it('mocks correctly', () => {
    class Bar {
      doSomething() {}
    }

    const Zoo = vi.mockObject(class Zoo extends Bar {
      ownMethod() {}
    })

    const zoo = new Zoo()
    expect(vi.isMockFunction(zoo.doSomething)).toBe(true)
    expect(vi.isMockFunction(zoo.ownMethod)).toBe(true)
  })
})
