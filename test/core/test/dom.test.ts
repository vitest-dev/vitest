/**
 * @vitest-environment jsdom
 */
import { expect, it } from 'vitest'

it('jsdom', () => {
  expect(window).toBeDefined()

  const dom = document.createElement('a')
  dom.href = 'https://vitest.dev'
  dom.textContent = '<Vitest>'

  expect(dom.outerHTML).toEqual('<a href="https://vitest.dev">&lt;Vitest&gt;</a>')
})

it('dispatchEvent doesn\'t throw', () => {
  const target = new EventTarget()
  const event = new Event('click')
  expect(() => target.dispatchEvent(event)).not.toThrow()
})
