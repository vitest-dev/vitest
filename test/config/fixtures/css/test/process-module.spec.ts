import { describe, expect, test } from 'vitest'
import { useRemoveStyles } from '../utils'

describe('processing module css', () => {
  useRemoveStyles()

  test('doesn\'t apply css', async () => {
    await import('../App.css')

    const element = document.createElement('div')
    element.className = 'main'
    const computed = window.getComputedStyle(element)
    expect(computed.display, 'css is not processed').toBe('block')
  })

  test('module is processed', async () => {
    const { default: styles } = await import('../App.module.css')

    expect(styles.module).toBe('_module_c70a46')
    expect(styles.someRandomValue).toBeUndefined()
    const element = document.createElement('div')
    element.className = '_main_c70a46 _module_c70a46'
    const computed = window.getComputedStyle(element)
    expect(computed.display, 'css is processed').toBe('flex')
    expect(computed.width).toBe('100px')
    expect(element).toMatchInlineSnapshot(`
      <div
        class="_main_c70a46 _module_c70a46"
      />
    `)
  })
})
