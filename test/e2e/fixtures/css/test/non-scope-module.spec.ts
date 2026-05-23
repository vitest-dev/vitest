import { expect, test } from 'vitest'

test('module is processed', async () => {
  const { default: styles } = await import('../App.module.css')

  expect(styles.module).toBe('module')
  expect(styles.someRandomValue).toBeUndefined()
  const element = document.createElement('div')
  element.className = `${styles.main} ${styles.module}`
  const computed = window.getComputedStyle(element)
  expect(computed.display).toBe('flex')
  expect(computed.width).toBe('100px')
  expect(element).toMatchInlineSnapshot(`
    <div
      class="main module"
    />
  `)
})
