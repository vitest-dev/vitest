import { expect, test } from 'vitest'
import { render } from './utils'

test('.toBeEmptyDOMElement', () => {
  const {queryByTestId} = render(`
    <span data-testid="not-empty">
        <span data-testid="empty"></span>
        <svg data-testid="svg-empty"></svg>
    </span>
    <span data-testid="with-comment"><!-- This Comment --></span>
    <span data-testid="with-multiple-comments"><!-- Comment1 --><!-- Comment2 --></span>
    <span data-testid="with-element"><span></span></span>
    <span data-testid="with-element-and-comment"><!--Comment--><span></span></span>
    <span data-testid="with-whitespace"> </span>
    <span data-testid="with-text">Text</span>`)

  const empty = queryByTestId('empty')
  const notEmpty = queryByTestId('not-empty')
  const svgEmpty = queryByTestId('svg-empty')
  const withComment = queryByTestId('with-comment')
  const withMultipleComments = queryByTestId('with-multiple-comments')
  const withElement = queryByTestId('with-element')
  const withElementAndComment = queryByTestId('with-element-and-comment')
  const withWhitespace = queryByTestId('with-whitespace')
  const withText = queryByTestId('with-whitespace')
  const nonExistantElement = queryByTestId('not-exists')
  const fakeElement = {thisIsNot: 'an html element'}

  expect(empty).toBeEmptyDOMElement()
  expect(svgEmpty).toBeEmptyDOMElement()
  expect(notEmpty).not.toBeEmptyDOMElement()
  expect(withComment).toBeEmptyDOMElement()
  expect(withMultipleComments).toBeEmptyDOMElement()
  expect(withElement).not.toBeEmptyDOMElement()
  expect(withElementAndComment).not.toBeEmptyDOMElement()
  expect(withWhitespace).not.toBeEmptyDOMElement()
  expect(withText).not.toBeEmptyDOMElement()

  // negative test cases wrapped in throwError assertions for coverage.
  expect(() => expect(empty).not.toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(svgEmpty).not.toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(notEmpty).toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(withComment).not.toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(withMultipleComments).not.toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(withElement).toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(withElementAndComment).toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(withWhitespace).toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(withText).toBeEmptyDOMElement()).toThrowError()

  expect(() => expect(fakeElement).toBeEmptyDOMElement()).toThrowError()

  expect(() => {
    expect(nonExistantElement).toBeEmptyDOMElement()
  }).toThrowError()
})