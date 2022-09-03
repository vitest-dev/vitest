import { describe, expect, test } from 'vitest'
import { useRemoveStyles } from './utils'

describe('don\'t process css by default', () => {
  useRemoveStyles()

  test('doesn\'t apply css', async () => {
    await import('../src/App.css')

    const element = document.createElement('div')
    element.className = 'main'
    const computed = window.getComputedStyle(element)
    expect(computed.display).toBe('block')
  })

  test('module is not processed', async () => {
    const { default: styles } = await import('../src/App.module.css')

    expect(styles.module).toBe('module')
    expect(styles.someRandomValue).toBe('someRandomValue')
    const element = document.createElement('div')
    element.className = 'module'
    const computed = window.getComputedStyle(element)
    expect(computed.display).toBe('block')
    expect(computed.width).toBe('')
  })
})
