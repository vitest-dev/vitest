import { beforeAll, describe, expect, it } from 'vitest'

describe('successful suite', () => {
  it('successful child', () => {
    expect(true).toBe(true)
  })
})

describe('hook failure suite', () => {
  beforeAll(() => {
    throw new Error('before-all-marker')
  })

  it('blocked child', () => {})
})

describe('child failure suite', () => {
  it('failing child', () => {
    throw new Error('direct-child-marker')
  })
})

describe('nested failure suite', () => {
  describe('failing nested suite', () => {
    it('failing nested child', () => {
      throw new Error('nested-child-marker')
    })
  })
})
