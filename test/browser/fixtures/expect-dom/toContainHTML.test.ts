import { describe, expect, test } from 'vitest'
import { render } from './utils'

/* eslint-disable max-statements */
describe('.toContainHTML', () => {
  test('handles positive and negative cases', () => {
    const {queryByTestId} = render(`
    <span data-testid="grandparent">
      <span data-testid="parent">
        <span data-testid="child"></span>
      </span>
      <svg data-testid="svg-element"></svg>
    </span>
    `)

    const grandparent = queryByTestId('grandparent')
    const parent = queryByTestId('parent')
    const child = queryByTestId('child')
    const nonExistentElement = queryByTestId('not-exists')
    const fakeElement = {thisIsNot: 'an html element'}
    const stringChildElement = '<span data-testid="child"></span>'
    const stringChildElementSelfClosing = '<span data-testid="child" />'
    const incorrectStringHtml = '<span data-testid="child"></div>'
    const nonExistentString = '<span> Does not exists </span>'
    const svgElement = queryByTestId('svg-element')

    expect(grandparent).toContainHTML(stringChildElement)
    expect(parent).toContainHTML(stringChildElement)
    expect(child).toContainHTML(stringChildElement)
    expect(child).toContainHTML(stringChildElementSelfClosing)
    expect(grandparent).not.toContainHTML(nonExistentString)
    expect(parent).not.toContainHTML(nonExistentString)
    expect(child).not.toContainHTML(nonExistentString)
    expect(child).not.toContainHTML(nonExistentString)
    expect(grandparent).toContainHTML(incorrectStringHtml)
    expect(parent).toContainHTML(incorrectStringHtml)
    expect(child).toContainHTML(incorrectStringHtml)

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() =>
      expect(nonExistentElement).not.toContainHTML(stringChildElement),
    ).toThrow()
    expect(() =>
      // @ts-expect-error testing invalid input
      expect(nonExistentElement).not.toContainHTML(nonExistentElement),
    ).toThrow()
    expect(() =>
      // @ts-expect-error testing invalid input
      expect(stringChildElement).not.toContainHTML(fakeElement),
    ).toThrow()
    expect(() =>
      expect(svgElement).toContainHTML(stringChildElement),
    ).toThrow()
    expect(() =>
      expect(grandparent).not.toContainHTML(stringChildElement),
    ).toThrow()
    expect(() =>
      expect(parent).not.toContainHTML(stringChildElement),
    ).toThrow()
    expect(() =>
      expect(child).not.toContainHTML(stringChildElement),
    ).toThrow()
    expect(() =>
      expect(child).not.toContainHTML(stringChildElement),
    ).toThrow()
    expect(() =>
      expect(child).not.toContainHTML(stringChildElementSelfClosing),
    ).toThrow()
    expect(() => expect(child).toContainHTML(nonExistentString)).toThrow()
    expect(() => expect(parent).toContainHTML(nonExistentString)).toThrow()
    expect(() =>
      expect(grandparent).toContainHTML(nonExistentString),
    ).toThrow()
      // @ts-expect-error testing invalid input
    expect(() => expect(child).toContainHTML(nonExistentElement)).toThrow()
    expect(() =>
      // @ts-expect-error testing invalid input
      expect(parent).toContainHTML(nonExistentElement),
    ).toThrow()
    expect(() =>
      // @ts-expect-error testing invalid input
      expect(grandparent).toContainHTML(nonExistentElement),
    ).toThrow()
    expect(() =>
      expect(nonExistentElement).not.toContainHTML(incorrectStringHtml),
    ).toThrow()
    expect(() =>
      expect(grandparent).not.toContainHTML(incorrectStringHtml),
    ).toThrow()
    expect(() =>
      expect(child).not.toContainHTML(incorrectStringHtml),
    ).toThrow()
    expect(() =>
      expect(parent).not.toContainHTML(incorrectStringHtml),
    ).toThrow()
  })

  test('throws with an expected text', async () => {
    const {queryByTestId} = render('<span data-testid="child"></span>')
    const htmlElement = queryByTestId('child')
    const nonExistentString = '<div> non-existent element </div>'

    let errorMessage
    try {
      expect(htmlElement).toContainHTML(nonExistentString)
    } catch (error) {
      errorMessage = error.message
    }

    expect(errorMessage).toMatchInlineSnapshot(`
      expect(element).toContainHTML()
      Expected:
        <div> non-existent element </div>
      Received:
        <span
        data-testid="child"
      />
    `)
  })
})
