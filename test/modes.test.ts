import { it, describe, assert } from '../src'

describe.skip('skipped suite', () => {
  it('no fail as it is skipped', () => {
    assert.equal(Math.sqrt(4), 3)
  })
})

describe.todo('unimplemented suite')
