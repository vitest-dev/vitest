import { describe, expect, it } from 'vitest'
import { createChainable } from '../../../packages/vitest/src/runtime/chain'

describe('chainable', () => {
  it('creates', () => {
    const chain = createChainable(['a', 'b'], function() {
      return this
    })

    expect(chain()).toEqual({})
    expect(chain.a()).toEqual({ a: true })

    chain.a

    expect(chain()).toEqual({})
    expect(chain.b.a()).toEqual({ a: true, b: true })

    expect(chain.b.a.b.a.b()).toEqual({ a: true, b: true })
    expect(chain.a.a.a.a.a.a()).toEqual({ a: true })
  })
})
