import { expect, it } from 'vitest'
import { replaceLast } from '../../../packages/vitest/src/utils/externalize'

it('replaceLast', () => {
  expect(replaceLast('ababc', 'b', 'a')).toEqual('abaac')
  expect(replaceLast('ababc', /a(b)/g, '$1$1')).toEqual('abbbc')
})
