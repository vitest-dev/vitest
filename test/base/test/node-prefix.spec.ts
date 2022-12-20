import packageUrl from 'url'
import nodeUrl from 'node:url'
import { expect, it } from 'vitest'

it('vitest respects node prefix', () => {
  expect(packageUrl).not.toHaveProperty('URL')
  expect(packageUrl).not.toHaveProperty('URLSearchParams')
  expect(packageUrl).not.toHaveProperty('fileURLToPath')
  expect(nodeUrl).toHaveProperty('URL')
  expect(nodeUrl).toHaveProperty('URLSearchParams')
  expect(nodeUrl).toHaveProperty('fileURLToPath')
})
