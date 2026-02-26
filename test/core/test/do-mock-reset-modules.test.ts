import { expect, test, vi } from 'vitest'

test('multiple resetModules and doMock for indirect actual module', async () => {
  vi.doUnmock('./fixtures/increment')

  const { incrementIndirect: originalIncrement } = await import('./fixtures/increment-indirect')
  expect(originalIncrement(1)).toBe(2)

  vi.doMock('./fixtures/increment', () => ({
    increment: (num: number) => num + 10,
  }))
  vi.resetModules()

  const { incrementIndirect: incrementWith10 } = await import('./fixtures/increment-indirect')
  expect(incrementWith10(1)).toBe(11)

  vi.doMock('./fixtures/increment', () => ({
    increment: (num: number) => num + 20,
  }))
  vi.resetModules()

  const { incrementIndirect: incrementWith20 } = await import('./fixtures/increment-indirect')
  expect(incrementWith20(1)).toBe(21)

  vi.doMock('./fixtures/increment', () => ({
    increment: (num: number) => num + 30,
  }))

  const { incrementIndirect: incrementWith20Still } = await import('./fixtures/increment-indirect')
  expect(incrementWith20Still(1)).toBe(21)
})

test('multiple doMock for direct virtual module', async () => {
  // @ts-expect-error virtual module
  const { value: originalValue } = await import('virtual-module-direct')
  expect(originalValue).toBe('original-direct')

  vi.doMock('virtual-module-direct', () => ({
    value: 'direct-1',
  }))

  // @ts-expect-error virtual module
  const { value: mockedValue1 } = await import('virtual-module-direct')
  expect(mockedValue1).toBe('direct-1')

  vi.doMock('virtual-module-direct', () => ({
    value: 'direct-2',
  }))

  // @ts-expect-error virtual module
  const { value: mockedValue2 } = await import('virtual-module-direct')
  expect(mockedValue2).toBe('direct-2')
})

test('multiple resetModules and doMock for indirect virtual module', async () => {
  const { getVirtualValue: originalGetVirtualValue } = await import('./fixtures/virtual-module-indirect')
  expect(originalGetVirtualValue()).toBe('original-indirect')

  vi.doMock('virtual-module-indirect', () => ({ value: 'indirect-1' }))
  vi.resetModules()

  const { getVirtualValue: mockedGetVirtualValue1 } = await import('./fixtures/virtual-module-indirect')
  expect(mockedGetVirtualValue1()).toBe('indirect-1')

  vi.resetModules()
  vi.doMock('virtual-module-indirect', () => ({ value: 'indirect-2' }))

  const { getVirtualValue: mockedGetVirtualValue2 } = await import('./fixtures/virtual-module-indirect')
  expect(mockedGetVirtualValue2()).toBe('indirect-2')
})
