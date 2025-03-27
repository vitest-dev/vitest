import { expect, test } from 'vitest'

test('.toBeInTheDocument', () => {
  const window = document.defaultView

  window.customElements.define(
    'custom-element-document',
    class extends window.HTMLElement {
      constructor() {
        super()
        this.attachShadow({mode: 'open'}).innerHTML =
          '<div data-testid="custom-element-child"></div>'
      }
    },
  )

  document.body.innerHTML = `
    <span data-testid="html-element"><span>Html Element</span></span>
    <svg data-testid="svg-element"></svg>
    <custom-element-document data-testid="custom-element"></custom-element-document>`

  const htmlElement = document.querySelector('[data-testid="html-element"]')
  const svgElement = document.querySelector('[data-testid="svg-element"]')
  const customElementChild = document
    .querySelector('[data-testid="custom-element"]')
    .shadowRoot.querySelector('[data-testid="custom-element-child"]')
  const detachedElement = document.createElement('div')
  const fakeElement = {thisIsNot: 'an html element'}
  const undefinedElement = undefined
  const nullElement = null

  expect(htmlElement).toBeInTheDocument()
  expect(svgElement).toBeInTheDocument()
  expect(customElementChild).toBeInTheDocument()
  expect(detachedElement).not.toBeInTheDocument()
  expect(nullElement).not.toBeInTheDocument()

  // negative test cases wrapped in throwError assertions for coverage.
  const expectToBe = /expect.*\.toBeInTheDocument/
  const expectNotToBe = /expect.*not\.toBeInTheDocument/
  const userInputNode = /an HTMLElement or an SVGElement/
  expect(() => expect(htmlElement).not.toBeInTheDocument()).toThrowError(
    expectNotToBe,
  )
  expect(() => expect(svgElement).not.toBeInTheDocument()).toThrowError(
    expectNotToBe,
  )
  expect(() => expect(detachedElement).toBeInTheDocument()).toThrowError(
    expectToBe,
  )
  expect(() => expect(fakeElement).toBeInTheDocument()).toThrowError(
    userInputNode,
  )
  expect(() => expect(nullElement).toBeInTheDocument()).toThrowError(
    userInputNode,
  )
  expect(() => expect(undefinedElement).toBeInTheDocument()).toThrowError(
    userInputNode,
  )
  expect(() => expect(undefinedElement).not.toBeInTheDocument()).toThrowError(
    userInputNode,
  )
})