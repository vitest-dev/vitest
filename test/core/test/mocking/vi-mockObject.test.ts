import { expect, test, vi } from 'vitest'

test('vi.mockObject() mocks methods', () => {
  const mocked = mockModule()

  expect(mocked.method.name).toBe('method')
  expect(mocked.Class.name).toBe('Class')
  expect(mocked.method()).toBe(undefined)
  expect(new mocked.Class()).toBeInstanceOf(mocked.Class)
})

test('when properties are spied, they keep the implementation', () => {
  const module = mockModule('autospy')
  expect(module.method()).toBe(42)
  expect(module.method).toHaveBeenCalled()

  const instance = new module.Class()
  expect(instance.method()).toBe(42)
  expect(instance.method).toHaveBeenCalled()
  expect(module.Class.prototype.method).toHaveBeenCalledTimes(1)
})

test('vi.restoreAllMocks() does not affect mocks', () => {
  const mocked = mockModule()

  vi.restoreAllMocks()

  expect(mocked.method()).toBe(undefined)
  expect(new mocked.Class()).toBeInstanceOf(mocked.Class)
})

test('vi.mockRestore() does not affect mocks', () => {
  const mocked = mockModule()

  vi.mocked(mocked.method).mockRestore()

  expect(mocked.method()).toBe(undefined)
  expect(new mocked.Class()).toBeInstanceOf(mocked.Class)
})

test('vi.mockRestore() on respied method does not restore it to the original', async ({ annotate }) => {
  await annotate('https://github.com/vitest-dev/vitest/issues/8319', 'issue')

  const mocked = mockModule()
  const spy = vi.spyOn(mocked, 'method')

  expect(mocked.method()).toBe(undefined)

  spy.mockRestore()

  expect(mocked.method()).toBe(undefined)
})

test('instance mocks are independently tracked, but prototype shares the state', () => {
  const { Class } = mockModule()
  const t1 = new Class()
  const t2 = new Class()
  t1.method()
  expect(t1.method).toHaveBeenCalledTimes(1)
  t2.method()
  expect(t1.method).toHaveBeenCalledTimes(1)
  expect(t2.method).toHaveBeenCalledTimes(1)
  expect(Class.prototype.method).toHaveBeenCalledTimes(2)

  vi.resetAllMocks()
  t1.method()
  expect(t1.method).toHaveBeenCalledTimes(1)
  t2.method()
  expect(t1.method).toHaveBeenCalledTimes(1)
  expect(t2.method).toHaveBeenCalledTimes(1)
  expect(Class.prototype.method).toHaveBeenCalledTimes(2)

  vi.mocked(t1.method).mockReturnValue(100)
  t1.method()
  expect(t1.method).toHaveBeenCalledTimes(2)
  // tracks methods even when t1.method implementation is overriden
  expect(Class.prototype.method).toHaveBeenCalledTimes(3)
})

test('instance methods inherit the implementation, but can override the local ones', () => {
  const { Class } = mockModule()
  const t1 = vi.mocked(new Class())
  const t2 = vi.mocked(new Class())

  t1.method.mockReturnValue(100)
  expect(t1.method()).toBe(100)
  expect(t1.method).toHaveBeenCalled()
  expect(t2.method).not.toHaveBeenCalled()

  expect(Class.prototype.method).toHaveBeenCalledTimes(1)

  Class.prototype.method.mockReturnValue(200)
  expect(t1.method()).toBe(100)
  expect(t2.method()).toBe(200)

  expect(Class.prototype.method).toHaveBeenCalledTimes(3)

  vi.resetAllMocks()

  expect(t1.method()).toBe(undefined)
  expect(t2.method()).toBe(undefined)

  Class.prototype.method.mockReturnValue(300)

  expect(t1.method()).toBe(300)
  expect(t2.method()).toBe(300)
})

test('vi.mockReset() does not break inherited properties', () => {
  const { Class } = mockModule()
  const instance1 = new Class()

  expect(instance1.method()).toBe(undefined)

  expect(instance1.method).toHaveBeenCalledTimes(1)
  expect(Class.prototype.method).toHaveBeenCalledTimes(1)

  vi.mocked(instance1.method).mockReturnValue(100)

  expect(instance1.method()).toBe(100)

  expect(instance1.method).toHaveBeenCalledTimes(2)
  expect(Class.prototype.method).toHaveBeenCalledTimes(2)

  vi.resetAllMocks()

  expect(instance1.method()).toBe(undefined)

  expect(instance1.method).toHaveBeenCalledTimes(1)
  expect(Class.prototype.method).toHaveBeenCalledTimes(1)

  const instance2 = new Class()
  const instance3 = new Class()

  instance2.method()

  expect(instance2.method).not.toBe(instance3.method)

  expect(instance2.method).toHaveBeenCalledTimes(1)
  expect(instance3.method).toHaveBeenCalledTimes(0)
})

function mockModule(type: 'automock' | 'autospy' = 'automock') {
  return vi.mockObject({
    [Symbol.toStringTag]: 'Module',
    __esModule: true,
    method() {
      return 42
    },
    Class: class {
      method() {
        return 42
      }
    },
  }, { spy: type === 'autospy' })
}
