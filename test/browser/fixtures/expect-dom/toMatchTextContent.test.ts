import { describe, expect, test } from 'vitest'
import { render } from './utils'

describe('.toMatchTextContent', () => {
  test('handles positive test cases', () => {
    const {queryByTestId} = render(`<span data-testid="count-value">2</span>`)

    expect(queryByTestId('count-value')).toMatchTextContent('2')
    expect(queryByTestId('count-value')).toMatchTextContent(2)
    expect(queryByTestId('count-value')).toMatchTextContent(/2/)
    expect(queryByTestId('count-value')).not.toMatchTextContent('21')
  })

  test('handles text nodes', () => {
    const {container} = render(`<span>example</span>`)

    expect(container.querySelector('span')?.firstChild).toMatchTextContent(
      'example',
    )
  })

  test('handles fragments', () => {
    const {asFragment} = render(`<span>example</span>`)

    expect(asFragment()).toMatchTextContent('example')
  })

  test('handles negative test cases', () => {
    const {queryByTestId} = render(`<span data-testid="count-value">2</span>`)

    expect(() =>
      expect(queryByTestId('count-value2')).toMatchTextContent('2'),
    ).toThrow()

    expect(() =>
      expect(queryByTestId('count-value')).toMatchTextContent('3'),
    ).toThrow()
    expect(() =>
      expect(queryByTestId('count-value')).not.toMatchTextContent('2'),
    ).toThrow()
  })

  test('normalizes whitespace by default', () => {
    const {container} = render(`
      <span>
        Step
          1
            of
              4
      </span>
    `)

    expect(container.querySelector('span')).toMatchTextContent('Step 1 of 4')
  })

  test('allows whitespace normalization to be turned off', () => {
    const {container} = render(`<span>&nbsp;&nbsp;Step 1 of 4</span>`)

    expect(container.querySelector('span')).toMatchTextContent('  Step 1 of 4', {
      normalizeWhitespace: false,
    })
  })

  test('can handle multiple levels', () => {
    const {container} = render(`<span id="parent"><span>Step 1 
    
    of 4</span></span>`)

    expect(container.querySelector('#parent')).toMatchTextContent('Step 1 of 4')
  })

  test('can handle multiple levels with content spread across descendants', () => {
    const {container} = render(`
        <span id="parent">
            <span>Step</span>
            <span>      1</span>
            <span><span>of</span></span>


            4</span>
        </span>
    `)

    expect(container.querySelector('#parent')).toMatchTextContent('Step 1 of 4')
  })

  test('does not throw error with empty content', () => {
    const {container} = render(`<span></span>`)
    expect(container.querySelector('span')).toMatchTextContent('')
  })

  test('is case-sensitive', () => {
    const {container} = render('<span>Sensitive text</span>')

    expect(container.querySelector('span')).toMatchTextContent('Sensitive text')
    expect(container.querySelector('span')).not.toMatchTextContent(
      'sensitive text',
    )
  })

  test('when matching with empty string and element with content, suggest using toBeEmptyDOMElement instead', () => {
    // https://github.com/testing-library/jest-dom/issues/104
    const {container} = render('<span>not empty</span>')

    expect(() =>
      expect(container.querySelector('span')).toMatchTextContent(''),
    ).toThrow(/toBeEmptyDOMElement\(\)/)
  })
})