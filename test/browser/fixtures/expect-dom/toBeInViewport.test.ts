import { describe, expect, it } from 'vitest'
import { render } from './utils'

describe('toBeInViewport', () => {
  it('should work', async () => {
    // Apply margin and width to small element, and padding to body and html because firefox's rendering causes a bit space between the element and the viewport
    const { container } = render(`
      <style>body, html { padding: 30px; }</style>
      <div id="big" style="height: 10000px;"></div>
      <div id="small" style="width: 50px; margin: 30px;">foo</div>
    `)

    await expect(container.querySelector('#big')).toBeInViewport()
    await expect(container.querySelector('#small')).not.toBeInViewport()
    
    // Scroll to make small element visible
    container.querySelector('#small')?.scrollIntoView()
    await expect(container.querySelector('#small')).toBeInViewport()
    await expect(container.querySelector('#small')).toBeInViewport({ ratio: 1 })
  })

  it('should respect ratio option', async () => {
    const { container } = render(`
      <style>body, div, html { padding: 0; margin: 0; }</style>
      <div id="big" style="height: 400vh;"></div>
    `)

    await expect(container.querySelector('div')).toBeInViewport()
    await expect(container.querySelector('div')).toBeInViewport({ ratio: 0.1 })
    await expect(container.querySelector('div')).toBeInViewport({ ratio: 0.2 })
    await expect(container.querySelector('div')).toBeInViewport({ ratio: 0.24 })
    
    // In this test, element's ratio is approximately 0.25 (viewport height / element height = 100vh / 400vh = 0.25)
    // IntersectionObserver may return slightly different values due to browser rendering
    await expect(container.querySelector('div')).toBeInViewport({ ratio: 0.24 })
    await expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.26 })
    
    await expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.3 })
    await expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.7 })
    await expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.8 })
  })

  it('should report intersection even if fully covered by other element', async () => {
    const { container } = render(`
      <h1>hello</h1>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: red; z-index: 1000;"></div>
    `)
    
    await expect(container.querySelector('h1')).toBeInViewport()
  })
})