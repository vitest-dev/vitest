import { describe, expect, test, vi } from 'vitest'
import * as c from '../src/module-esm'
import { defaultImport } from '../src/default-import'

/**
 * @vitest-environment happy-dom
 */

describe('spyOn', () => {
  test('correctly infers method types', async () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue('world')
    expect(window.localStorage.getItem('hello')).toEqual('world')
  })

  test('spyOn default export of module', async () => {
    const mySpy = vi.spyOn(c, 'default')
    expect(defaultImport()).equals(1)
    expect(mySpy).toHaveBeenCalled()
  })
})
