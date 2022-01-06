import { expect, it } from 'vitest'
import { format } from 'prettier'
import givens from 'givens'

it('prettier', () => {
  expect(format('const a :   A = \'t\'', { parser: 'typescript' }).trim())
    .toEqual('const a: A = "t";'.trim())
})

it('has nested default', () => {
  expect(typeof givens).toBe('function')
  expect(givens.name).toBe('getGiven')
})
