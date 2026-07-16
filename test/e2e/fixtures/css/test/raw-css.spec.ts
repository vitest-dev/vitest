import { describe, expect, test } from 'vitest'

describe('raw css imports bypass css processing', () => {
  test('?raw returns the file source text', async () => {
    const { default: raw } = await import('../App.css?raw')

    expect(typeof raw).toBe('string')
    expect(raw).toContain('.main {')
    expect(raw).toContain('display: flex;')
  })

  test('?raw returns the source text for css modules too', async () => {
    const { default: raw } = await import('../App.module.css?raw')

    expect(typeof raw).toBe('string')
    expect(raw).toContain('.module {')
    expect(raw).toContain('width: 100px;')
  })
})
