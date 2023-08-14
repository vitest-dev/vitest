import { describe, expect, test } from 'vitest'
import { useRemoveStyles } from './utils'

describe('processing inline css', () => {
  useRemoveStyles()

  test('doesn\'t apply css', async () => {
    await import('../src/App.module.css?inline')

    const element = document.createElement('div')
    element.className = 'main'
    const computed = window.getComputedStyle(element)
    expect(computed.display, 'css is not processed').toBe('block')
  })

  test('returns a string', async () => {
    const { default: style } = await import('../src/App.module.css?inline')
    expect(typeof style).toBe('string');
    console.log(style);
  })
})
