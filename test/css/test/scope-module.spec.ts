import { describe, expect, test } from 'vitest'

describe('don\'t process css by default', () => {
  test('module is processed and scoped', async () => {
    const { default: styles } = await import('../src/App.module.css')

    expect(styles.module).toMatch(/_module/)
    expect(styles.someRandomValue).toBeUndefined()
    const element = document.createElement('div')
    element.className = 'module main'
    const computedStatic = window.getComputedStyle(element)
    expect(computedStatic.display).toBe('block')
    expect(computedStatic.width).toBe('')

    element.className = `${styles.module} ${styles.main}`
    const computedModules = window.getComputedStyle(element)
    expect(computedModules.display).toBe('flex')
    expect(computedModules.width).toBe('100px')
  })
})
