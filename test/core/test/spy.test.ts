import { describe, expect, spyOn, test } from 'vitest'

/**
 * @vitest-environment jsdom
 */

describe('spyOn', () => {
  test('correctly infers method types', async() => {
    spyOn(localStorage, 'getItem').mockReturnValue('world')
    expect(window.localStorage.getItem('hello')).toEqual('world')
  })
})
