import { retryDynamicImport } from '../src/retry-dynamic-import'

vi.mock('../src/dynamic-module', () => {
  return { foo: 'bar' }
})

describe('retry-dynamic-import', () => {
  it('should dynamic import module success', async () => {
    expect(await retryDynamicImport()).toEqual({ foo: 'bar' })
  })
  it('should throw when retry over 3 times', async () => {
    vi.doMock('../src/dynamic-module', () => {
      throw new Error('foobar')
    })
    await expect(retryDynamicImport()).rejects.toThrowError(new Error('import dynamic module failed.'))
  })
})
