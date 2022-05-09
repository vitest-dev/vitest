import { expect, it } from 'vitest'
import { timeout } from './timeout'

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout * 2)))

it('1', () => {
  expect(1).toEqual(1)
})

it('share same global', () => {
  // @ts-expect-error injected
  expect(globalThis.a).toEqual('foo')
})
