import { describe, expect, test, vi } from 'vitest'

/**
 * @vitest-environment happy-dom
 */

describe('spyOn', () => {
  test('correctly infers method types', async() => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue('world')
    expect(window.localStorage.getItem('hello')).toEqual('world')
  })
})
