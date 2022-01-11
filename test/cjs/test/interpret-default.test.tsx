import { expect, it } from 'vitest'
import { format } from 'prettier'
import givens from 'givens'
import tempDir from 'temp-dir'

it('prettier', () => {
  expect(format('const a :   A = \'t\'', { parser: 'typescript' }).trim())
    .toEqual('const a: A = "t";'.trim())
})

it('has nested default', () => {
  expect(typeof givens).toBe('function')
  expect(givens.name).toBe('getGiven')
})

it('nested default is not an object', () => {
  expect(typeof tempDir).toBe('string')
})
