import { describe, expect, test } from 'vitest'
import { useRemoveStyles } from '../utils'

describe('process only css, not module css', () => {
  useRemoveStyles()

  test('apply css', async () => {
    await import('../App.css')

    const element = document.createElement('div')
    element.className = 'main'
    const computed = window.getComputedStyle(element)
    expect(computed.display).toBe('flex')
    expect(element).toMatchInlineSnapshot(`
      <div
        class="main"
      />
    `)
  })

  test('module is not processed', async () => {
    const { default: styles } = await import('../App.module.css')

    expect(styles.module).toBe('_module_c70a46')
    expect(styles.someRandomValue).toBe('_someRandomValue_c70a46')
    const element = document.createElement('div')
    element.className = '_module_c70a46'
    const computed = window.getComputedStyle(element)
    expect(computed.display).toBe('block')
    expect(computed.width).toBe('')
    expect(element).toMatchInlineSnapshot(`
      <div
        class="_module_c70a46"
      />
    `)
  })
})
