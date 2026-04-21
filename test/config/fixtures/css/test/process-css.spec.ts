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

    expect(styles.module).toBe('_module_cdbed7')
    expect(styles.someRandomValue).toBe('_someRandomValue_cdbed7')
    const element = document.createElement('div')
    element.className = '_module_cdbed7'
    const computed = window.getComputedStyle(element)
    expect(computed.display).toBe('block')
    expect(computed.width).toBe('')
    expect(element).toMatchInlineSnapshot(`
      <div
        class="_module_cdbed7"
      />
    `)
  })
})
