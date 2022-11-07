import { describe, expect, it } from 'vitest'

import * as other from '../src/other.cjs'
import defaultOther from '../src/other.cjs'

describe('correctly identified named default', () => {
  it('default should be on default', () => {
    expect(other.default).toBe(defaultOther)
  })

  it('default is an object with default', () => {
    expect(other.default).toMatchObject({ default: 2 })
    expect(defaultOther).toMatchObject({ default: 2 })
  })
})
