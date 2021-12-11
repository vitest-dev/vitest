import { it, expect } from 'vitest'
import { format } from 'prettier'

it('prettier', () => {
  expect(format('const a :   A = \'t\'', { parser: 'typescript' }).trim())
    .toEqual('const a: A = "t";'.trim())
})
