import { describe, expect, test } from 'vitest'
import { render } from './utils'

function getDOMElement(htmlString: string, selector: string) {
  const doc = document.implementation.createHTMLDocument('')
  doc.body.innerHTML = htmlString
  return doc.querySelector(selector)
}

// A required field without a value is invalid
const invalidInputHtml = `<input required>`

const invalidInputNode = getDOMElement(invalidInputHtml, 'input')

// A form is invalid if it contains an invalid input
const invalidFormHtml = `<form>${invalidInputHtml}</form>`

const invalidFormNode = getDOMElement(invalidFormHtml, 'form')

describe('.toBeInvalid', () => {
  test('handles <input/>', () => {
    const {queryByTestId} = render(`
      <div>
        <input data-testid="no-aria-invalid">
        <input data-testid="aria-invalid" aria-invalid>
        <input data-testid="aria-invalid-value" aria-invalid="true">
        <input data-testid="aria-invalid-false" aria-invalid="false">
      </div>
      `)

    expect(queryByTestId('no-aria-invalid')).not.toBeInvalid()
    expect(queryByTestId('aria-invalid')).toBeInvalid()
    expect(queryByTestId('aria-invalid-value')).toBeInvalid()
    expect(queryByTestId('aria-invalid-false')).not.toBeInvalid()
    expect(invalidInputNode).toBeInvalid()

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() =>
      expect(queryByTestId('no-aria-invalid')).toBeInvalid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid')).not.toBeInvalid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-value')).not.toBeInvalid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-false')).toBeInvalid(),
    ).toThrowError()
    expect(() => expect(invalidInputNode).not.toBeInvalid()).toThrowError()
  })

  test('handles <form/>', () => {
    const {queryByTestId} = render(`
      <form data-testid="valid">
        <input>
      </form>
      `)

    expect(queryByTestId('valid')).not.toBeInvalid()
    expect(invalidFormNode).toBeInvalid()

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() => expect(queryByTestId('valid')).toBeInvalid()).toThrowError()
    expect(() => expect(invalidFormNode).not.toBeInvalid()).toThrowError()
  })

  test('handles any element', () => {
    const {queryByTestId} = render(`
      <ol data-testid="valid">
        <li data-testid="no-aria-invalid" > </li>
        <li data-testid="aria-invalid" aria-invalid>  </li>
        <li data-testid="aria-invalid-value" aria-invalid="true">  </li>
        <li data-testid="aria-invalid-false" aria-invalid="false">  </li>
      </ol>
      `)

    expect(queryByTestId('valid')).not.toBeInvalid()
    expect(queryByTestId('no-aria-invalid')).not.toBeInvalid()
    expect(queryByTestId('aria-invalid')).toBeInvalid()
    expect(queryByTestId('aria-invalid-value')).toBeInvalid()
    expect(queryByTestId('aria-invalid-false')).not.toBeInvalid()

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() => expect(queryByTestId('valid')).toBeInvalid()).toThrowError()
    expect(() =>
      expect(queryByTestId('no-aria-invalid')).toBeInvalid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid')).not.toBeInvalid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-value')).not.toBeInvalid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-false')).toBeInvalid(),
    ).toThrowError()
  })
})

describe('.toBeValid', () => {
  test('handles <input/>', () => {
    const {queryByTestId} = render(`
      <div>
        <input data-testid="no-aria-invalid">
        <input data-testid="aria-invalid" aria-invalid>
        <input data-testid="aria-invalid-value" aria-invalid="true">
        <input data-testid="aria-invalid-false" aria-invalid="false">
      </div>
      `)

    expect(queryByTestId('no-aria-invalid')).toBeValid()
    expect(queryByTestId('aria-invalid')).not.toBeValid()
    expect(queryByTestId('aria-invalid-value')).not.toBeValid()
    expect(queryByTestId('aria-invalid-false')).toBeValid()
    expect(invalidInputNode).not.toBeValid()

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() =>
      expect(queryByTestId('no-aria-invalid')).not.toBeValid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid')).toBeValid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-value')).toBeValid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-false')).not.toBeValid(),
    ).toThrowError()
    expect(() => expect(invalidInputNode).toBeValid()).toThrowError()
  })

  test('handles <form/>', () => {
    const {queryByTestId} = render(`
      <form data-testid="valid">
        <input>
      </form>
      `)

    expect(queryByTestId('valid')).toBeValid()
    expect(invalidFormNode).not.toBeValid()

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() => expect(queryByTestId('valid')).not.toBeValid()).toThrowError()
    expect(() => expect(invalidFormNode).toBeValid()).toThrowError()
  })

  test('handles any element', () => {
    const {queryByTestId} = render(`
      <ol data-testid="valid">
        <li data-testid="no-aria-invalid" > </li>
        <li data-testid="aria-invalid" aria-invalid>  </li>
        <li data-testid="aria-invalid-value" aria-invalid="true">  </li>
        <li data-testid="aria-invalid-false" aria-invalid="false">  </li>
      </ol>
      `)

    expect(queryByTestId('valid')).toBeValid()
    expect(queryByTestId('no-aria-invalid')).toBeValid()
    expect(queryByTestId('aria-invalid')).not.toBeValid()
    expect(queryByTestId('aria-invalid-value')).not.toBeValid()
    expect(queryByTestId('aria-invalid-false')).toBeValid()

    // negative test cases wrapped in throwError assertions for coverage.
    expect(() => expect(queryByTestId('valid')).not.toBeValid()).toThrowError()
    expect(() =>
      expect(queryByTestId('no-aria-invalid')).not.toBeValid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid')).toBeValid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-value')).toBeValid(),
    ).toThrowError()
    expect(() =>
      expect(queryByTestId('aria-invalid-false')).not.toBeValid(),
    ).toThrowError()
  })
})