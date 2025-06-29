import { afterEach, describe, expect, it } from 'vitest'
import { render } from './utils'

describe('toBeInViewport', () => {
  let cleanupFunctions: Array<() => void> = []

  afterEach(() => {
    cleanupFunctions.forEach(cleanup => cleanup())
    cleanupFunctions = []
  })

  it('should pass when element is visible in document viewport', () => {
    const { container } = render(`
      <div data-testid="visible-element" style="width: 50px; height: 50px; background: red; position: absolute; top: 10px; left: 10px;">
        Visible Element
      </div>
    `)

    expect(container.querySelector('[data-testid="visible-element"]')).toBeInViewport()
  })

  it('should fail when element is positioned outside document viewport (right)', () => {
    const { container } = render(`
      <div data-testid="hidden-right" style="width: 50px; height: 50px; background: red; position: fixed; top: 10px; left: ${window.innerWidth + 100}px;">
        Hidden Right
      </div>
    `)

    expect(container.querySelector('[data-testid="hidden-right"]')).not.toBeInViewport()
  })

  it('should fail when element is positioned outside document viewport (bottom)', () => {
    const { container } = render(`
      <div data-testid="hidden-bottom" style="width: 50px; height: 50px; background: red; position: fixed; top: ${window.innerHeight + 100}px; left: 10px;">
        Hidden Bottom
      </div>
    `)

    expect(container.querySelector('[data-testid="hidden-bottom"]')).not.toBeInViewport()
  })

  it('should fail when element is positioned outside document viewport (negative coordinates)', () => {
    const { container } = render(`
      <div data-testid="hidden-negative" style="width: 50px; height: 50px; background: red; position: fixed; top: -100px; left: 10px;">
        Hidden Above
      </div>
    `)

    expect(container.querySelector('[data-testid="hidden-negative"]')).not.toBeInViewport()
  })

  it('should handle partially visible elements - default behavior should pass', () => {
    const { container } = render(`
      <div data-testid="partially-visible" style="width: 100px; height: 100px; background: red; position: fixed; top: ${window.innerHeight - 50}px; left: 10px;">
        Partially Visible
      </div>
    `)

    // By default, partially visible should be considered "in viewport"
    expect(container.querySelector('[data-testid="partially-visible"]')).toBeInViewport()
  })

  it('should fail when element is completely hidden by display:none', () => {
    const { container } = render(`
      <div data-testid="display-none" style="width: 50px; height: 50px; background: red; position: absolute; top: 10px; left: 10px; display: none;">
        Display None
      </div>
    `)

    expect(container.querySelector('[data-testid="display-none"]')).not.toBeInViewport()
  })

  it('should fail when element is completely hidden by visibility:hidden', () => {
    const { container } = render(`
      <div data-testid="visibility-hidden" style="width: 50px; height: 50px; background: red; position: absolute; top: 10px; left: 10px; visibility: hidden;">
        Visibility Hidden
      </div>
    `)

    expect(container.querySelector('[data-testid="visibility-hidden"]')).not.toBeInViewport()
  })

  it('should fail when element has zero dimensions', () => {
    const { container } = render(`
      <div data-testid="zero-dimensions" style="width: 0px; height: 0px; background: red; position: absolute; top: 10px; left: 10px;">
        Zero Dimensions
      </div>
    `)

    expect(container.querySelector('[data-testid="zero-dimensions"]')).not.toBeInViewport()
  })

  it('should handle elements with scrollable parent containers', () => {
    // Create a scrollable container programmatically since we need to test scrolling behavior
    const scrollContainer = document.createElement('div')
    scrollContainer.style.width = '200px'
    scrollContainer.style.height = '200px'
    scrollContainer.style.overflow = 'auto'
    scrollContainer.style.border = '1px solid black'
    scrollContainer.style.position = 'relative'
    
    const tallContent = document.createElement('div')
    tallContent.style.height = '400px'
    tallContent.style.width = '100%'
    
    const testElement = document.createElement('div')
    testElement.setAttribute('data-testid', 'scrollable-element')
    testElement.style.width = '50px'
    testElement.style.height = '50px'
    testElement.style.backgroundColor = 'red'
    testElement.style.position = 'absolute'
    testElement.style.top = '300px'
    testElement.style.left = '10px'
    testElement.textContent = 'Scrollable Element'
    
    scrollContainer.appendChild(tallContent)
    scrollContainer.appendChild(testElement)
    document.body.appendChild(scrollContainer)
    
    cleanupFunctions.push(() => {
      if (scrollContainer.parentNode) {
        scrollContainer.parentNode.removeChild(scrollContainer)
      }
    })

    // Initially not in viewport due to scrolling
    expect(testElement).not.toBeInViewport()
    
    // Scroll to make element visible
    scrollContainer.scrollTop = 150
    
    // Now should be in viewport
    expect(testElement).toBeInViewport()
  })

  it('should handle elements with CSS transforms', () => {
    const { container } = render(`
      <div data-testid="transformed-visible" style="width: 50px; height: 50px; background: red; position: absolute; top: 10px; left: 10px; transform: translateX(50px);">
        Transformed Visible
      </div>
    `)

    expect(container.querySelector('[data-testid="transformed-visible"]')).toBeInViewport()
  })

  it('should fail when elements are transformed outside viewport', () => {
    const { container } = render(`
      <div data-testid="transformed-hidden" style="width: 50px; height: 50px; background: red; position: fixed; top: 10px; left: 10px; transform: translateX(${window.innerWidth}px);">
        Transformed Hidden
      </div>
    `)

    expect(container.querySelector('[data-testid="transformed-hidden"]')).not.toBeInViewport()
  })

  it('should handle nested scrollable containers', () => {
    const { container } = render(`
      <div style="width: 300px; height: 300px; overflow: auto; border: 1px solid blue;">
        <div style="width: 200px; height: 200px; overflow: auto; border: 1px solid green; margin: 10px;">
          <div data-testid="nested-element" style="width: 50px; height: 50px; background: red; position: absolute; top: 10px; left: 10px;">
            Nested Element
          </div>
        </div>
      </div>
    `)

    expect(container.querySelector('[data-testid="nested-element"]')).toBeInViewport()
  })

  it('should handle elements that are detached from DOM', () => {
    const detachedElement = document.createElement('div')
    detachedElement.style.width = '50px'
    detachedElement.style.height = '50px'
    detachedElement.style.backgroundColor = 'red'
    
    expect(detachedElement).not.toBeInViewport()
  })

  it('should work with different element types', () => {
    const { container } = render(`
      <button data-testid="button-element" style="position: absolute; top: 10px; left: 10px;">
        Button Element
      </button>
      <img data-testid="img-element" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="position: absolute; top: 70px; left: 10px; width: 50px; height: 50px;" alt="test image" />
      <input data-testid="input-element" type="text" style="position: absolute; top: 130px; left: 10px;" />
    `)

    expect(container.querySelector('[data-testid="button-element"]')).toBeInViewport()
    expect(container.querySelector('[data-testid="img-element"]')).toBeInViewport()
    expect(container.querySelector('[data-testid="input-element"]')).toBeInViewport()
  })

  it('should handle elements with opacity', () => {
    const { container } = render(`
      <div data-testid="transparent" style="width: 50px; height: 50px; background: red; position: absolute; top: 10px; left: 10px; opacity: 0;">
        Transparent Element
      </div>
      <div data-testid="semi-transparent" style="width: 50px; height: 50px; background: red; position: absolute; top: 70px; left: 10px; opacity: 0.5;">
        Semi-transparent Element
      </div>
    `)

    // Elements with opacity 0 or low opacity should still be considered in viewport if positioned correctly
    // This differs from toBeVisible which might consider opacity
    expect(container.querySelector('[data-testid="transparent"]')).toBeInViewport()
    expect(container.querySelector('[data-testid="semi-transparent"]')).toBeInViewport()
  })
})