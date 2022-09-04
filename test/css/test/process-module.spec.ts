import { describe, expect, test } from 'vitest'
import { useRemoveStyles } from './utils'

describe('processing module css', () => {
  useRemoveStyles()

  test('doesn\'t apply css', async () => {
    await import('../src/App.css')

    const element = document.createElement('div')
    element.className = 'main'
    const computed = window.getComputedStyle(element)
    expect(computed.display, 'css is not processed').toBe('block')
  })

  test('module is processed', async () => {
    const { default: styles } = await import('../src/App.module.css')

    expect(styles.module).toBe('_module_6dc87e')
    expect(styles.someRandomValue).toBeUndefined()
    const element = document.createElement('div')
    element.className = '_main_6dc87e _module_6dc87e'
    const computed = window.getComputedStyle(element)
    expect(computed.display, 'css is processed').toBe('flex')
    expect(computed.width).toBe('100px')
    expect(element).toMatchInlineSnapshot(`
      <div
        class="_main_6dc87e _module_6dc87e"
      />
    `)
  })
})
