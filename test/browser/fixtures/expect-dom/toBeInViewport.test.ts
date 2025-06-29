import { describe, expect, it } from 'vitest'
import { render } from './utils'

describe('toBeInViewport', () => {
  it('should work', () => {
    const { container } = render(`
      <div id="big" style="height: 10000px;"></div>
      <div id="small">foo</div>
    `)

    expect(container.querySelector('#big')).toBeInViewport()
    expect(container.querySelector('#small')).not.toBeInViewport()
    
    // Scroll to make small element visible
    container.querySelector('#small')?.scrollIntoView()
    expect(container.querySelector('#small')).toBeInViewport()
    expect(container.querySelector('#small')).toBeInViewport({ ratio: 1 })
  })

  it('should respect ratio option', () => {
    const { container } = render(`
      <style>body, div, html { padding: 0; margin: 0; }</style>
      <div id="big" style="height: 400vh;"></div>
    `)

    expect(container.querySelector('div')).toBeInViewport()
    expect(container.querySelector('div')).toBeInViewport({ ratio: 0.1 })
    expect(container.querySelector('div')).toBeInViewport({ ratio: 0.2 })
    expect(container.querySelector('div')).toBeInViewport({ ratio: 0.24 })
    
    // In this test, element's ratio is 0.25 (viewport height / element height = 100vh / 400vh = 0.25)
    expect(container.querySelector('div')).toBeInViewport({ ratio: 0.25 })
    expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.26 })
    
    expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.3 })
    expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.7 })
    expect(container.querySelector('div')).not.toBeInViewport({ ratio: 0.8 })
  })

  it('should report intersection even if fully covered by other element', () => {
    const { container } = render(`
      <h1>hello</h1>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: red; z-index: 1000;"></div>
    `)
    
    expect(container.querySelector('h1')).toBeInViewport()
  })
})