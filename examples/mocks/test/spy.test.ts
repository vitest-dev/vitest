import * as squaredModule from '../src/squared.js'
import { squared } from '../src/squared.js'

describe('spyOn', () => {
  test('with mock', () => {
    vi.mock('any')
    vi.spyOn(squaredModule, 'squared')
    expect(squared).not.toHaveBeenCalled()
  })
})
