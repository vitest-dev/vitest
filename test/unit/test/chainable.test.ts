import { createChainable } from '@vitest/runner/utils'
import { describe, expect, it } from 'vitest'

describe('chainable', () => {
  it('creates', () => {
    const chain = createChainable(['a', 'b'], function () {
      return this
    })

    expect(chain()).toEqual({})
    expect(chain.a()).toEqual({ a: true })

    // eslint-disable-next-line ts/no-unused-expressions
    chain.a

    expect(chain()).toEqual({})
    expect(chain.b.a()).toEqual({ a: true, b: true })

    expect(chain.b.a.b.a.b()).toEqual({ a: true, b: true })
    expect(chain.a.a.a.a.a.a()).toEqual({ a: true })
  })
})
